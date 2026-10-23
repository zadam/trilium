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
 * Buffers the low-level soft-delete writes and becca bookkeeping produced by
 * a subtree deletion (see {@link BBranch.deleteBranch}) so they can be
 * executed in bulk.
 *
 * A large subtree delete used to issue two SQL statements plus one
 * `entity_changes` insert for every single deleted entity, and the
 * ENTITY_DELETED listener in `becca_loader` removed each attribute from the
 * shared `attributeIndex` bucket one by one — an O(bucket) array filter per
 * entity. Trees with hundreds of thousands of same-named attributes
 * (e.g. line anchors produced by imports) turned a subtree delete into
 * hours of 100% CPU with the whole application blocked. With the buffer
 * active, `markAsDeleted()` only records the entity, and the outermost
 * `deleteBranch()` flushes everything as a handful of chunked
 * `UPDATE ... WHERE pk IN (...)` statements, bulk `entity_changes` inserts
 * and one set-based becca cleanup pass.
 *
 * Event dispatch semantics are unchanged: ENTITY_DELETED fires per entity at
 * the same point of the recursion as before (handler scripts, inverse
 * relations, sorting re-checks all keep working). Only the mechanical
 * becca map/index maintenance is deferred to the bulk pass.
 */
const UPDATE_CHUNK = 900;
const ENTITY_CHANGES_CHUNK = 300;

interface BufferedDeletion {
    entityName: string;
    primaryKey: string;
    id: string;
    deleteId: string | null;
    touchDateModified: boolean;
    entity: BNote | BBranch | BAttribute;
    entityChange: Omit<EntityChange, "id">;
}

let buffer: BufferedDeletion[] | null = null;

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
    return true;
}

export function add(deletion: BufferedDeletion): void {
    buffer!.push(deletion);
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
function bulkAttributeMaintenance(entries: BufferedDeletion[]): void {
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

    if (!entries || entries.length === 0) {
        return;
    }

    const startTimestamp = Date.now();
    const counts: Record<string, number> = {};

    // Events were already dispatched per entity by markAsDeleted() at the same
    // recursion points as in the unbatched path; handlers that deleted further
    // entities (inverse-relation cascades) went through the same buffered path.
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
