import { beforeAll, describe, expect, it } from "vitest";

import becca from "../becca/becca.js";
import { init as clsInit } from "./context.js";
import attributeService from "./attributes.js";
import noteService from "./notes.js";
import * as bulkDeletion from "./bulk_deletion.js";
import type { BufferedDeletion } from "./bulk_deletion.js";

/** Creates a text note under root and returns it. */
function makeNote(title: string) {
    return clsInit(() =>
        noteService.createNewNote({
            parentNoteId: "root",
            title,
            content: "",
            type: "text"
        }).note
    );
}

function makeLabel(noteId: string, name: string, value: string) {
    return clsInit(() => attributeService.createLabel(noteId, name, value));
}

function makeRelation(noteId: string, name: string, targetNoteId: string) {
    return clsInit(() => attributeService.createRelation(noteId, name, targetNoteId));
}

function entry(attributeId: string): BufferedDeletion {
    const attribute = becca.attributes[attributeId];
    return {
        entityName: "attributes",
        primaryKey: "attributeId",
        id: attributeId,
        deleteId: null,
        touchDateModified: false,
        entity: attribute,
        entityChange: {
            entityName: "attributes",
            entityId: attributeId,
            hash: "test",
            isErased: false,
            isSynced: true,
            changeId: "test0000000",
            componentId: "test",
            instanceId: "test",
            utcDateChanged: attribute?.utcDateModified || ""
        }
    };
}

describe("bulk deletion", () => {
    beforeAll(() => {
        // The in-memory fixture DB and initializeCore are booted by the
        // server suite setup (apps/server/spec/setup.ts), through which
        // co-located trilium-core specs run.
    });

    describe("add", () => {
        it("throws without an active batch, deduplicates inside one, and flushes", () => {
            expect(() => bulkDeletion.add(entry("nonexistent"))).toThrow(/active batch/);

            const note = makeNote("bulk-deletion-add");
            const label = makeLabel(note.noteId, "bulkdeladd", "x");
            expect(becca.attributes[label.attributeId]).toBeDefined();

            expect(bulkDeletion.begin()).toBe(true);
            try {
                bulkDeletion.add(entry(label.attributeId));
                bulkDeletion.add(entry(label.attributeId)); // deduplicated
                expect(bulkDeletion.isActive()).toBe(true);
                clsInit(() => bulkDeletion.flush());
                expect(bulkDeletion.isActive()).toBe(false);
            } finally {
                if (bulkDeletion.isActive()) {
                    bulkDeletion.flush();
                }
            }

            expect(becca.attributes[label.attributeId]).toBeUndefined();
            expect(note.ownedAttributes.some((attr) => attr.attributeId === label.attributeId)).toBe(false);
        });
    });

    describe("bulkAttributeMaintenance", () => {
        it("detaches deleted attributes from owners, targets and shared index buckets, keeping survivors", () => {
            const note1 = makeNote("bulk-deletion-note-1");
            const note2 = makeNote("bulk-deletion-note-2");
            const label1 = makeLabel(note1.noteId, "bulkdel", "one");
            const label2 = makeLabel(note2.noteId, "bulkdel", "two");
            const keptLabel = makeLabel(note1.noteId, "bulkdel", "kept");
            const relation = makeRelation(note1.noteId, "bulklink", note2.noteId);

            // preconditions: everything exists and the shared bucket holds all three labels
            expect(becca.attributes[label1.attributeId]).toBeDefined();
            expect(becca.attributes[label2.attributeId]).toBeDefined();
            expect(becca.attributeIndex["label-bulkdel"].map((attr) => attr.attributeId))
                .toEqual(expect.arrayContaining([label1.attributeId, label2.attributeId, keptLabel.attributeId]));

            bulkDeletion.bulkAttributeMaintenance([
                entry(label1.attributeId),
                entry(label2.attributeId),
                entry(relation.attributeId)
            ]);

            // deleted attributes are gone from the map and from owner arrays
            expect(becca.attributes[label1.attributeId]).toBeUndefined();
            expect(becca.attributes[label2.attributeId]).toBeUndefined();
            expect(becca.attributes[relation.attributeId]).toBeUndefined();
            expect(note1.ownedAttributes.some((attr) => attr.attributeId === label1.attributeId)).toBe(false);
            expect(note1.ownedAttributes.some((attr) => attr.attributeId === relation.attributeId)).toBe(false);
            expect(note1.ownedAttributes.some((attr) => attr.attributeId === keptLabel.attributeId)).toBe(true);

            // the incoming relation is removed from the target note
            expect(note2.targetRelations.some((rel) => rel.attributeId === relation.attributeId)).toBe(false);

            // the shared bucket was rebuilt once and keeps only the survivor
            expect(becca.attributeIndex["label-bulkdel"].map((attr) => attr.attributeId))
                .toEqual([keptLabel.attributeId]);
        });

        it("invalidates the attribute caches of affected notes", () => {
            const note = makeNote("bulk-deletion-note-3");
            const label = makeLabel(note.noteId, "bulkdelcache", "x");

            note.getAttributes(); // populates __attributeCache
            expect(note).toHaveProperty("__attributeCache", expect.any(Array));

            bulkDeletion.bulkAttributeMaintenance([entry(label.attributeId)]);

            expect(becca.attributes[label.attributeId]).toBeUndefined();
            expect(note).toHaveProperty("__attributeCache", null);
        });
    });
});
