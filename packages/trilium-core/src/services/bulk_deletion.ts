import type { EntityChange } from "@triliumnext/commons";

import becca from "../becca/becca.js";
import type BAttribute from "../becca/entities/battribute.js";
import type BBranch from "../becca/entities/bbranch.js";
import type BNote from "../becca/entities/bnote.js";
import * as cls from "./context.js";
import dateUtils from "./utils/date.js";
import { getLog } from "./log.js";
import { getSql } from "./sql/index.js";
import getInstanceId from "./instance_id.js";
import entityChangesService from "./entity_changes.js";

/**
 * Buffers the soft-delete writes and becca bookkeeping of a subtree deletion
 * (see {@link BBranch.deleteBranch}) so the flush can execute them in bulk:
 * chunked per-table `UPDATE`s, bulk `entity_changes` inserts and a set-based
 * attribute maintenance pass instead of per-entity statements and per-attribute
 * `attributeIndex` bucket filters. Events still fire per entity at the same
 * recursion points as in the unbatched path.
 */
const UPDATE_CHUNK = 900;
const ENTITY_CHANGES_CHUNK = 300;

export interface BufferedDeletion {
    entityName: string;
    primaryKey: string;
    id: string;
    deleteId: string | null;
    touchDateModified: boolean;
    entity: BNote | BBranch | BAttribute;
    entityChange: Omit<EntityChange, "id">;
}

let buffer: BufferedDeletion[] | null = null;
const bufferedKeys = new Set<string>();

export function isActive(): boolean {
    return buffer !== null;
}

/**
 * Starts buffering when no batch is active. Returns `true` when this call
 * started the batch (i.e., the caller is the outermost deletion and must
 * call {@link flush}); nested deletions keep adding to the running batch.
 */
export function begin(): boolean {
    if (buffer) {
        return false;
    }

    buffer = [];
    bufferedKeys.clear();
    return true;
}

export function add(deletion: BufferedDeletion): void {
    if (!buffer) {
        throw new Error("Cannot buffer a deletion without an active batch.");
    }

    const key = `${deletion.entityName}/${deletion.id}`;

    if (bufferedKeys.has(key)) {
        // handlers can mark the same entity deleted again; keep one entry
        return;
    }

    bufferedKeys.add(key);
    buffer.push(deletion);
}

/** Removes an attribute from its owner's arrays immediately, so event
 *  handlers and inverse-relation cascades stop seeing it; the expensive
 *  map / index / cache work is deferred to {@link flush}. */
export function detachAttribute(attribute: BAttribute): void {
    const note = becca.notes[attribute.noteId];

    if (note) {
        note.ownedAttributes = note.ownedAttributes.filter((attr) => attr.attributeId !== attribute.attributeId);
    }

    if (attribute.type === "relation") {
        const targetNote = becca.notes[attribute.value];

        if (targetNote) {
            targetNote.targetRelations = targetNote.targetRelations.filter((rel) => rel.attributeId !== attribute.attributeId);
        }
    }
}

function bulkUpdate(entries: BufferedDeletion[]): void {
    const sql = getSql();
    const utcNow = dateUtils.utcNowDateTime();
    const localNow = dateUtils.localNowDateTime();

    // Group by entityName + deleteId, preserving first-seen (traversal) order:
    // children still end up before parents within each table.
    const groups = new Map<string, BufferedDeletion[]>();

    for (const entry of entries) {
        const key = `${entry.entityName}\n${entry.deleteId ?? ""}`;
        let group = groups.get(key);

        if (!group) {
            group = [];
            groups.set(key, group);
        }

        group.push(entry);
    }

    for (const group of groups.values()) {
        const { entityName, primaryKey, deleteId } = group[0];

        const withDateModified = group.filter((entry) => entry.touchDateModified);

        for (let i = 0; i < group.length; i += UPDATE_CHUNK) {
            const chunk = group.slice(i, i + UPDATE_CHUNK);

            sql.execute(
                /*sql*/`UPDATE ${entityName} SET isDeleted = 1, deleteId = ?, utcDateModified = ?
                        WHERE ${primaryKey} IN (${chunk.map(() => "?").join(",")})`,
                [deleteId, utcNow, ...chunk.map((entry) => entry.id)]
            );

            if (withDateModified.length > 0) {
                const touched = chunk.filter((entry) => entry.touchDateModified);

                if (touched.length > 0) {
                    sql.execute(
                        /*sql*/`UPDATE ${entityName} SET dateModified = ?
                                WHERE ${primaryKey} IN (${touched.map(() => "?").join(",")})`,
                        [localNow, ...touched.map((entry) => entry.id)]
                    );
                }
            }
        }

        // Record the entity changes in bulk; RETURNING keeps the per-row ids
        // feeding the cls transaction tracking (frontend updates, sync).
        for (let i = 0; i < group.length; i += ENTITY_CHANGES_CHUNK) {
            const chunk = group.slice(i, i + ENTITY_CHANGES_CHUNK);
            const params: unknown[] = [];

            for (const entry of chunk) {
                const ec = entry.entityChange;
                params.push(ec.entityName, ec.entityId, ec.hash, ec.isErased ? 1 : 0, ec.isSynced ? 1 : 0, ec.changeId, ec.componentId, ec.instanceId, ec.utcDateChanged);
            }

            const rows = sql.wrap(
                /*sql*/`INSERT OR REPLACE INTO entity_changes
                        (entityName, entityId, hash, isErased, isSynced, changeId, componentId, instanceId, utcDateChanged)
                        VALUES ${chunk.map(() => "(?,?,?,?,?,?,?,?,?)").join(",")}
                        RETURNING id`,
                (statement) => statement.all(params)
            ) as { id: number | bigint }[];

            if (rows) {
                for (const row of rows) {
                    cls.putEntityChange({ id: row.id } as EntityChange);
                }
            }
        }
    }
}

/**
 * Set-based equivalent of the per-entity attribute maintenance done by
 * attributeDeleted() in `becca_loader.ts`: one pass per note and one rebuild
 * per affected attributeIndex bucket instead of one O(bucket) array filter
 * per deleted attribute. Branch and note maintenance stays per-entity (it is
 * cheap and the deletion recursion depends on it being immediate).
 */
export function bulkAttributeMaintenance(entries: BufferedDeletion[]): void {
    const deletedAttributeIds = new Set(entries.map((entry) => entry.id));
    const deletedByNoteId = new Map<string, BAttribute[]>();
    const affectedIndexKeys = new Set<string>();
    const deletedRelationIdsByTargetNoteId = new Map<string, Set<string>>();

    for (const { entity } of entries) {
        const attribute = entity as BAttribute;
        let list = deletedByNoteId.get(attribute.noteId);

        if (!list) {
            list = [];
            deletedByNoteId.set(attribute.noteId, list);
        }

        list.push(attribute);
        affectedIndexKeys.add(`${attribute.type}-${attribute.name.toLowerCase()}`);

        if (attribute.type === "relation") {
            let ids = deletedRelationIdsByTargetNoteId.get(attribute.value);

            if (!ids) {
                ids = new Set();
                deletedRelationIdsByTargetNoteId.set(attribute.value, ids);
            }

            ids.add(attribute.attributeId);
        }
    }

    for (const [noteId, deletedAttributes] of deletedByNoteId) {
        const note = becca.notes[noteId];

        if (!note) {
            continue;
        }

        note.ownedAttributes = note.ownedAttributes.filter((attr) => !deletedAttributeIds.has(attr.attributeId));

        if (deletedAttributes.some((attr) => attr.isAffectingSubtree) || note.isInherited()) {
            note.invalidateSubTree();
        } else {
            note.invalidateThisCache();
        }

        if (note.title === undefined && !note.parentBranches.length && !note.children.length
            && !note.ownedAttributes.length) {
            // mirrors dropOrphanedSkeleton() in becca_loader
            delete becca.notes[note.noteId];
        }
    }

    for (const [targetNoteId, deletedRelationIds] of deletedRelationIdsByTargetNoteId) {
        const targetNote = becca.notes[targetNoteId];

        if (targetNote) {
            targetNote.targetRelations = targetNote.targetRelations.filter((rel) => !deletedRelationIds.has(rel.attributeId));
        }
    }

    for (const key of affectedIndexKeys) {
        if (key in becca.attributeIndex) {
            becca.attributeIndex[key] = becca.attributeIndex[key].filter((attr) => !deletedAttributeIds.has(attr.attributeId));
        }
    }

    for (const { id } of entries) {
        delete becca.attributes[id];
    }
}

/**
 * Executes all buffered writes and becca maintenance. Must be called by the
 * outermost deletion, ideally in a `finally` block so buffered marks persist
 * just as the interleaved per-entity writes would have.
 */
export function flush(): void {
    const entries = buffer;
    buffer = null;
    bufferedKeys.clear();

    if (!entries || entries.length === 0) {
        return;
    }

    const startTimestamp = Date.now();
    const counts: Record<string, number> = {};

    // events already fired per entity from markAsDeleted(); handler cascades
    // went through the same buffered path
    bulkUpdate(entries);
    bulkAttributeMaintenance(entries.filter((entry) => entry.entityName === "attributes"));
    entityChangesService.recalculateMaxEntityChangeId();

    for (const entry of entries) {
        counts[entry.entityName] = (counts[entry.entityName] ?? 0) + 1;
    }

    getLog().info(
        `Bulk deletion flush: ${entries.length} entities (${Object.entries(counts)
            .map(([entityName, count]) => `${entityName}: ${count}`)
            .join(", ")}) in ${Date.now() - startTimestamp}ms`
    );
}
