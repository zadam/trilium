import { COLLAB_PERSON_COLORS } from "@triliumnext/commons";
import { t } from "i18next";
import { describe, expect, it, vi } from "vitest";

import becca from "../becca/becca.js";
import { load } from "../becca/becca_loader.js";
import type BCollaboration from "../becca/entities/bcollaboration.js";
import type BNote from "../becca/entities/bnote.js";
import { getContext } from "../services/context.js";
import noteService from "../services/notes.js";
import collabService, { type CollaborationSettings } from "./service.js";

// scrypt runs in pure JS under the standalone suite and is far slower there.
const isBrowserRuntime = typeof window !== "undefined";
if (isBrowserRuntime) {
    vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
}

let counter = 0;

function createNote(parentNoteId: string): BNote {
    counter++;

    return getContext().init(() =>
        noteService.createNewNote({
            parentNoteId,
            title: `collab-service-spec-${counter}`,
            content: "<p>hello</p>",
            type: "text"
        })
    ).note;
}

// The host API opens the request context the entity saves need; the spec opens it here.
const create = (noteId: string, settings: CollaborationSettings) =>
    getContext().init(() => collabService.createCollaboration(noteId, settings));
const update = (collab: BCollaboration, settings: CollaborationSettings) =>
    getContext().init(() => collabService.updateCollaboration(collab, settings));
const stop = (collab: BCollaboration) =>
    getContext().init(() => collabService.stopCollaboration(collab));

const OPEN_VIEW: CollaborationSettings = {
    includeSubtree: false,
    viewMode: "open",
    editMode: "none",
    createMode: "none"
};

describe("collaboration service", () => {
    it("refuses system, hidden, protected and already collaborated notes", async () => {
        await expect(create("root", OPEN_VIEW)).rejects.toThrow(/System notes/);
        await expect(create("_hidden", OPEN_VIEW)).rejects.toThrow(/System notes/);
        await expect(create("does-not-exist", OPEN_VIEW)).rejects.toThrow(/does not exist/);

        // _share is the hidden-subtree parent that still accepts child notes.
        const hiddenChild = createNote("_share");
        await expect(create(hiddenChild.noteId, OPEN_VIEW)).rejects.toThrow(/System notes/);

        const protectedNote = createNote("root");
        protectedNote.isProtected = true;
        await expect(create(protectedNote.noteId, OPEN_VIEW)).rejects.toThrow(/Protected notes/);

        const note = createNote("root");
        await create(note.noteId, OPEN_VIEW);
        await expect(create(note.noteId, OPEN_VIEW)).rejects.toThrow(/already has/);
    });

    it("validates the mode combinations, the passwords and the link name", async () => {
        const note = createNote("root");
        const attempt = (overrides: Partial<CollaborationSettings>) =>
            create(note.noteId, { ...OPEN_VIEW, ...overrides });

        await expect(attempt({
            createMode: "password", createPassword: "secret", editMode: "open"
        })).rejects.toThrow(/child notes are included/);
        await expect(attempt({
            includeSubtree: true, createMode: "password", createPassword: "secret"
        })).rejects.toThrow(/editing is allowed/);
        await expect(attempt({ viewMode: "password", viewPassword: "secret", editMode: "open" }))
            .rejects.toThrow(/cannot be open/);
        await expect(attempt({ viewMode: "password" })).rejects.toThrow(/view password/);
        await expect(attempt({ editMode: "password", editPassword: "abc" }))
            .rejects.toThrow(/edit password/);
        await expect(attempt({ slug: "no spaces" })).rejects.toThrow(/link name/);
        await expect(attempt({ slug: "-leading" })).rejects.toThrow(/link name/);
        await expect(attempt({ viewMode: "nope" as "open" })).rejects.toThrow(/mode/);
        await expect(attempt({ maxGuests: 0 })).rejects.toThrow(/guest limit/);
        await expect(attempt({ maxGuests: 2.5 })).rejects.toThrow(/guest limit/);
        await expect(attempt({ maxGuests: 1001 })).rejects.toThrow(/guest limit/);

        expect(becca.getActiveCollaborationForNote(note.noteId)).toBeNull();
    });

    it("defaults the guest limit and keeps it on an update that leaves it out", async () => {
        const note = createNote("root");
        const collab = await create(note.noteId, OPEN_VIEW);
        expect(collab.maxGuests).toBe(10);
        expect(collabService.toCollaborationDto(collab).maxGuests).toBe(10);

        await update(collab, { ...OPEN_VIEW, maxGuests: 3 });
        expect(collab.maxGuests).toBe(3);

        await update(collab, OPEN_VIEW);
        expect(collab.maxGuests).toBe(3);
    });

    it("names the host as set, cleaned up, and keeps the name on an update that leaves it out",
        async () => {
            const collab = await create(createNote("root").noteId,
                { ...OPEN_VIEW, hostName: "  Ada \u202ELovelace  " });
            expect(collab.hostName).toBe("Ada Lovelace");
            expect(collabService.toCollaborationDto(collab).hostName).toBe("Ada Lovelace");
            expect(collabService.getHostDisplayName(collab)).toBe("Ada Lovelace");

            await update(collab, OPEN_VIEW);
            expect(collab.hostName).toBe("Ada Lovelace");

            await update(collab, { ...OPEN_VIEW, hostName: " " });
            expect(collab.hostName).toBeNull();
            expect(collabService.getHostDisplayName(collab)).toBe(t("collab_theme.host_name"));

            getContext().init(() => collabService.setHostName(collab, "Grace"));
            expect(collab.hostName).toBe("Grace");

            // The host's color is one of the palette's, the first unless the host picks another.
            expect(collabService.getHostColor(collab)).toBe(COLLAB_PERSON_COLORS[0]);
            getContext().init(() => collabService.setHostColor(collab, "#D22A1E"));
            expect(collab.hostColor).toBe("#d22a1e");
            expect(collabService.getHostColor(collab)).toBe("#d22a1e");
            expect(collabService.toCollaborationDto(collab).hostColor).toBe("#d22a1e");
            getContext().init(() => collabService.setHostColor(collab, "#123456"));
            expect(collab.hostColor).toBeNull();
        });

    it("keeps its settings when becca loads them again, as after a restart", async () => {
        const collab = await create(createNote("root").noteId,
            { ...OPEN_VIEW, maxGuests: 25, hostName: "Ada" });
        getContext().init(() => collabService.setHostColor(collab, COLLAB_PERSON_COLORS[2]));

        getContext().init(() => load());

        expect(becca.getCollaboration(collab.collabId ?? "")).toMatchObject({
            maxGuests: 25, hostName: "Ada", hostColor: COLLAB_PERSON_COLORS[2]
        });
    });

    it("stores hashes, resolves by id and slug and unlocks capabilities", async () => {
        const note = createNote("root");

        const collab = await create(note.noteId, {
            includeSubtree: true,
            viewMode: "open",
            editMode: "password",
            createMode: "password",
            editPassword: "edit-pass",
            createPassword: "edit-pass",
            slug: " team-notes "
        });

        expect(collab.collabId).toBeDefined();
        expect(collab.slug).toBe("team-notes");
        expect(collab.viewPasswordHash).toBeNull();
        expect(collab.editPasswordHash).not.toBe("edit-pass");
        expect(collab.editPasswordHash).not.toBeNull();
        // The same password gets a fresh salt per capability, so the hashes differ.
        expect(collab.createPasswordHash).not.toBe(collab.editPasswordHash);

        expect(collabService.resolveCollaboration(collab.collabId ?? "")).toBe(collab);
        expect(collabService.resolveCollaboration("team-notes")).toBe(collab);
        expect(collabService.resolveCollaboration("unknown")).toBeNull();

        expect(collabService.getOpenCapabilities(collab)).toEqual([ "view" ]);
        expect(collabService.getPasswordGatedCapabilities(collab)).toEqual([ "edit", "create" ]);
        expect(collabService.getEffectiveCapabilities(collab, [])).toEqual([ "view" ]);

        expect(await collabService.unlockCapabilities(collab, "wrong")).toEqual([]);
        expect(await collabService.unlockCapabilities(collab, "edit-pass"))
            .toEqual([ "edit", "create" ]);
        expect(collabService.getEffectiveCapabilities(collab, [ "edit", "create" ]))
            .toEqual([ "view", "edit", "create" ]);
        // Holding "create" implies "edit".
        expect(collabService.getEffectiveCapabilities(collab, [ "create" ]))
            .toEqual([ "view", "edit", "create" ]);

        // A duplicate link name on another note is refused.
        const other = createNote("root");
        await expect(create(other.noteId, { ...OPEN_VIEW, slug: "team-notes" }))
            .rejects.toThrow(/already in use/);
    });

    it("scopes reads to the note or its subtree, never to protected or hidden notes", async () => {
        const root = createNote("root");
        const child = createNote(root.noteId);
        const grandchild = createNote(child.noteId);
        const sibling = createNote("root");
        const protectedChild = createNote(root.noteId);
        protectedChild.isProtected = true;

        const noteOnly = await create(root.noteId, OPEN_VIEW);

        expect(collabService.isNoteInCollabScope(noteOnly, root)).toBe(true);
        expect(collabService.isNoteInCollabScope(noteOnly, child)).toBe(false);
        expect(collabService.getCollaborationsForNote(child)).toEqual([]);

        await update(noteOnly, { ...OPEN_VIEW, includeSubtree: true });

        expect(collabService.isNoteInCollabScope(noteOnly, child)).toBe(true);
        expect(collabService.isNoteInCollabScope(noteOnly, grandchild)).toBe(true);
        expect(collabService.isNoteInCollabScope(noteOnly, sibling)).toBe(false);
        expect(collabService.isNoteInCollabScope(noteOnly, protectedChild)).toBe(false);
        const hidden = becca.getNoteOrThrow("_hidden");
        expect(collabService.isNoteInCollabScope(noteOnly, hidden)).toBe(false);
        expect(collabService.getCollaborationsForNote(grandchild)).toEqual([ noteOnly ]);
    });

    it("keeps a hash on update unless replaced or its mode is dropped, then stops", async () => {
        const note = createNote("root");
        const collab = await create(note.noteId, {
            includeSubtree: true,
            viewMode: "password",
            editMode: "password",
            createMode: "none",
            viewPassword: "view-pass",
            editPassword: "edit-pass"
        });
        const viewHash = collab.viewPasswordHash;

        await update(collab, {
            includeSubtree: true,
            viewMode: "password",
            editMode: "password",
            createMode: "none",
            editPassword: "new-edit-pass"
        });

        expect(collab.viewPasswordHash).toBe(viewHash);
        expect(await collabService.unlockCapabilities(collab, "edit-pass")).toEqual([]);
        expect(await collabService.unlockCapabilities(collab, "new-edit-pass")).toEqual([ "edit" ]);

        await update(collab, { ...OPEN_VIEW, includeSubtree: false });

        expect(collab.viewPasswordHash).toBeNull();
        expect(collab.viewPasswordSalt).toBeNull();
        expect(collab.editPasswordHash).toBeNull();
        expect(collabService.getEffectiveCapabilities(collab, [ "edit" ])).toEqual([ "view" ]);

        stop(collab);

        expect(collab.isDeleted).toBe(true);
        expect(collabService.resolveCollaboration(collab.collabId ?? "")).toBeNull();
        expect(becca.getActiveCollaborationForNote(note.noteId)).toBeNull();
        expect(collabService.getCollaborationsForNote(note)).toEqual([]);

        const again = await create(note.noteId, OPEN_VIEW);
        expect(again.collabId).not.toBe(collab.collabId);
    });
});
