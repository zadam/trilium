import { describe, expect, it } from "vitest";

import becca from "../becca.js";
import BCollaboration from "./bcollaboration.js";
import { getContext } from "../../services/context.js";
import { getSql } from "../../services/sql/index.js";

// Only the save test targets "root", so the active-collaboration lookup there sees one row.
function buildRow(collabId: string, noteId = "collab-spec-other-note") {
    return {
        collabId,
        noteId,
        includeSubtree: true,
        viewMode: "open" as const,
        editMode: "password" as const,
        createMode: "none" as const,
        editPasswordHash: "hash-edit",
        editPasswordSalt: "salt-edit"
    };
}

describe("BCollaboration static metadata", () => {
    it("exposes entityName, primaryKeyName and hashedProperties", () => {
        expect(BCollaboration.entityName).toBe("collaborations");
        expect(BCollaboration.primaryKeyName).toBe("collabId");
        expect(BCollaboration.hashedProperties).toEqual(expect.arrayContaining([
            "collabId", "noteId", "includeSubtree", "viewMode", "editMode", "createMode",
            "viewPasswordHash", "editPasswordHash", "createPasswordHash", "isDeleted"
        ]));
    });
});

describe("BCollaboration constructor", () => {
    it("returns early without populating fields when no row is given", () => {
        const collab = new BCollaboration();

        expect(collab.collabId).toBeUndefined();
        expect(collab.noteId).toBeUndefined();
    });

    it("populates fields, defaults the optional columns and registers itself in becca", () => {
        const collab = new BCollaboration(buildRow("collab-spec-1"));

        expect(collab.noteId).toBe("collab-spec-other-note");
        expect(collab.includeSubtree).toBe(true);
        expect(collab.viewMode).toBe("open");
        expect(collab.editMode).toBe("password");
        expect(collab.createMode).toBe("none");
        expect(collab.viewPasswordHash).toBeNull();
        expect(collab.viewPasswordSalt).toBeNull();
        expect(collab.editPasswordHash).toBe("hash-edit");
        expect(collab.createPasswordHash).toBeNull();
        expect(collab.slug).toBeNull();
        expect(collab.isDeleted).toBe(false);
        expect(typeof collab.utcDateCreated).toBe("string");
        expect(collab.utcDateModified).toBe(collab.utcDateCreated);
        expect(becca.collaborations["collab-spec-1"]).toBe(collab);
        expect(becca.getCollaboration("collab-spec-1")).toBe(collab);
        expect(becca.getEntity("collaborations", "collab-spec-1")).toBe(collab);
    });

    it("does not register in becca when the id is missing", () => {
        const before = Object.keys(becca.collaborations).length;

        const collab = new BCollaboration({ ...buildRow("ignored"), collabId: undefined });

        expect(collab.collabId).toBeUndefined();
        expect(Object.keys(becca.collaborations).length).toBe(before);
    });

    it("keeps supplied dates and reflects the deleted flag", () => {
        const collab = new BCollaboration({
            ...buildRow("collab-spec-2"),
            utcDateCreated: "2025-06-27 14:10:39.688+0300",
            utcDateModified: "2025-06-28 14:10:39.688+0300",
            isDeleted: true
        });

        expect(collab.utcDateCreated).toBe("2025-06-27 14:10:39.688+0300");
        expect(collab.utcDateModified).toBe("2025-06-28 14:10:39.688+0300");
        expect(collab.isDeleted).toBe(true);
    });
});

describe("BCollaboration getPojo", () => {
    it("returns every column, which is what sync writes back with sql.replace", () => {
        const collab = new BCollaboration({
            ...buildRow("collab-spec-pojo-1"),
            utcDateCreated: "2025-06-27 14:10:39.688+0300",
            utcDateModified: "2025-06-27 14:10:39.688+0300"
        });

        expect(collab.getPojo()).toEqual({
            collabId: "collab-spec-pojo-1",
            noteId: "collab-spec-other-note",
            includeSubtree: true,
            viewMode: "open",
            editMode: "password",
            createMode: "none",
            viewPasswordHash: null,
            viewPasswordSalt: null,
            editPasswordHash: "hash-edit",
            editPasswordSalt: "salt-edit",
            createPasswordHash: null,
            createPasswordSalt: null,
            slug: null,
            maxGuests: 10,
            utcDateCreated: "2025-06-27 14:10:39.688+0300",
            utcDateModified: "2025-06-27 14:10:39.688+0300",
            isDeleted: false
        });
    });
});

describe("BCollaboration save and delete", () => {
    it("persists the row, records an entity change and leaves becca when deleted", () => {
        const collabId = "collab-spec-save-1";
        const collab = new BCollaboration(buildRow(collabId, "root"));

        getContext().init(() => collab.save());

        const sql = getSql();
        const row = sql.getRow<Record<string, unknown>>(
            "SELECT * FROM collaborations WHERE collabId = ?",
            [ collabId ]
        );
        expect(row?.noteId).toBe("root");
        expect(row?.includeSubtree).toBe(1);
        expect(row?.editPasswordHash).toBe("hash-edit");
        expect(row?.isDeleted).toBe(0);

        const change = sql.getRow<{ hash: string; isSynced: number }>(
            `SELECT hash, isSynced FROM entity_changes
             WHERE entityName = 'collaborations' AND entityId = ?`,
            [ collabId ]
        );
        expect(change?.hash).toBe(collab.generateHash(false));
        expect(change?.isSynced).toBe(1);

        expect(becca.getActiveCollaborationForNote("root")?.collabId).toBe(collabId);
        expect(collab.getNote()?.noteId).toBe("root");

        getContext().init(() => collab.markAsDeletedSimple());

        const deletedFlag = sql.getValue(
            "SELECT isDeleted FROM collaborations WHERE collabId = ?", [ collabId ]);
        expect(deletedFlag).toBe(1);
        expect(becca.getCollaboration(collabId)).toBeNull();
        expect(becca.getActiveCollaborationForNote("root")).toBeNull();
    });
});
