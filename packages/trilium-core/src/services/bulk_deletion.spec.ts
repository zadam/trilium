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
                expect(bulkDeletion.add(entry(label.attributeId))).toBe(true);
                expect(bulkDeletion.add(entry(label.attributeId))).toBe(false); // deduplicated
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

        it("hides buffered attributes from readers before the flush and compacts the arrays afterwards", () => {
            const note1 = makeNote("bulk-deletion-visibility-1");
            const note2 = makeNote("bulk-deletion-visibility-2");
            const label = makeLabel(note1.noteId, "bulkvis", "x");
            const relation = makeRelation(note1.noteId, "bulkvisrel", note2.noteId);

            note1.getAttributes(); // populate the attribute cache

            expect(bulkDeletion.begin()).toBe(true);
            try {
                bulkDeletion.add(entry(label.attributeId));
                bulkDeletion.add(entry(relation.attributeId));

                // readers do not see batch-deleted attributes
                expect(note1.getOwnedAttributes().some((attr) => attr.attributeId === label.attributeId)).toBe(false);
                expect(note1.getOwnedAttributes().some((attr) => attr.attributeId === relation.attributeId)).toBe(false);
                expect(note1.getAttributes().some((attr) => attr.attributeId === label.attributeId)).toBe(false);
                expect(note2.getTargetRelations().some((rel) => rel.attributeId === relation.attributeId)).toBe(false);

                // the raw arrays are untouched until the flush
                expect(note1.ownedAttributes.some((attr) => attr.attributeId === label.attributeId)).toBe(true);
            } finally {
                clsInit(() => bulkDeletion.flush());
            }

            expect(note1.ownedAttributes.some((attr) => attr.attributeId === label.attributeId)).toBe(false);
            expect(becca.attributes[label.attributeId]).toBeUndefined();
            expect(bulkDeletion.hiddenAttributes()).toBeNull();
        });

        it("releases the hidden attribute set even when the flush fails midway", () => {
            const note = makeNote("bulk-deletion-flush-failure");
            const label = makeLabel(note.noteId, "bulkflush", "x");
            expect(becca.attributes[label.attributeId]).toBeDefined();

            const poison = makeLabel(note.noteId, "bulkflush2", "y");
            expect(bulkDeletion.begin()).toBe(true);
            // first entry of the group carries a primaryKey whose SQL cannot
            // execute, so the flush fails before finishing its writes
            bulkDeletion.add({ ...entry(poison.attributeId), primaryKey: "noSuchColumn" });
            bulkDeletion.add(entry(label.attributeId)); // its id lands in the hidden set
            expect(bulkDeletion.hiddenAttributes()?.has(label.attributeId)).toBe(true);

            expect(() => clsInit(() => bulkDeletion.flush())).toThrow();

            // the transaction rolled back and becca reloaded the rows; readers
            // must not keep hiding the attribute
            expect(bulkDeletion.hiddenAttributes()).toBeNull();
            expect(note.getOwnedAttributes().some((attr) => attr.attributeId === label.attributeId)).toBe(true);
        });

        it("terminates reciprocal inverse relations through the batched deleteBranch and compacts both owners", () => {
            const note1 = makeNote("bulk-deletion-reciprocal-1");
            const note2 = makeNote("bulk-deletion-reciprocal-2");
            // #relation:spouse definition with inverseRelation=spouse on both sides
            makeLabel(note1.noteId, "relation:spouse", "inverseRelation=spouse");
            makeLabel(note2.noteId, "relation:spouse", "inverseRelation=spouse");
            const forward = makeRelation(note1.noteId, "spouse", note2.noteId);
            const backward = makeRelation(note2.noteId, "spouse", note1.noteId);

            expect(becca.attributes[forward.attributeId]).toBeDefined();
            expect(becca.attributes[backward.attributeId]).toBeDefined();

            // deleting note1 cascades to the backward relation on note2 via the
            // inverse-relation handler; completing this call (no RangeError from
            // unbounded re-marks) is part of what is asserted
            clsInit(() => note1.getParentBranches()[0].deleteBranch());

            expect(becca.notes[note1.noteId]).toBeUndefined();
            expect(becca.notes[note2.noteId]).toBeDefined(); // outside the subtree, still alive
            expect(becca.attributes[forward.attributeId]).toBeUndefined();
            expect(becca.attributes[backward.attributeId]).toBeUndefined();
            expect(note2.ownedAttributes.some((attr) => attr.attributeId === backward.attributeId)).toBe(false);
            expect(note2.targetRelations.some((rel) => rel.attributeId === forward.attributeId)).toBe(false);
            expect(becca.attributeIndex["relation-spouse"].filter((attr) => attr.attributeId === forward.attributeId || attr.attributeId === backward.attributeId)).toEqual([]);
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
