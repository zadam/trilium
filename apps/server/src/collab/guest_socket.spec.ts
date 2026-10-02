import { cls, note_service as noteService, ws } from "@triliumnext/core";
import { revokeCollabGuest } from "@triliumnext/core/src/collab/presence.js";
import collabService from "@triliumnext/core/src/collab/service.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { admitGuestSocket } from "./guest_socket.js";

describe("admitGuestSocket", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function startCollab(viewMode: "open" | "password") {
        const { note } = cls.init(() => noteService.createNewNote({
            parentNoteId: "root", title: "guest socket", content: "", type: "text"
        }));
        const collab = await cls.init(() => collabService.createCollaboration(note.noteId, {
            includeSubtree: false, viewMode, editMode: "none", createMode: "none",
            viewPassword: viewMode === "password" ? "view-secret" : undefined
        }));

        return collab.collabId ?? "";
    }

    it("admits the host, and a guest whose page joined, while the host keeps them", async () => {
        const collabId = await startCollab("open");
        const url = `/?collab=${collabId}`;
        const grant = (fields = {}) => ({
            collab: { [collabId]: { guestId: "g1", capabilities: [], ...fields } }
        });

        expect(admitGuestSocket("/", {})).toBe(false);
        expect(admitGuestSocket("/?collab=unknown", {})).toBeNull();
        expect(admitGuestSocket(url, { loggedIn: true })).toEqual({
            collabId, guestId: null, unlocked: [], name: null, viewingNoteId: null,
            editingNoteId: null, isHost: true
        });

        // A page joins before it connects, so a socket without a grant has no page behind it.
        expect(admitGuestSocket(url, {})).toBeNull();
        expect(admitGuestSocket(url, grant({ name: " Grace‮ " }))).toEqual({
            collabId, guestId: "g1", unlocked: [], name: "Grace", viewingNoteId: null,
            editingNoteId: null, isHost: false
        });

        vi.spyOn(ws, "isCollabFull").mockReturnValueOnce(true);
        expect(admitGuestSocket(url, grant())).toEqual({ refused: "full", collabId });

        revokeCollabGuest(collabId, "g1");
        expect(admitGuestSocket(url, grant())).toBeNull();
    });

    it("refuses a grant without the view password on a collaboration that asks for it",
        async () => {
            const collabId = await startCollab("password");
            const session = (capabilities: ("view" | "edit")[]) => ({
                collab: { [collabId]: { guestId: "g2", capabilities } }
            });

            expect(admitGuestSocket(`/?collab=${collabId}`, session([]))).toBeNull();
            expect(admitGuestSocket(`/?collab=${collabId}`, session([ "view" ])))
                .toMatchObject({ guestId: "g2", unlocked: [ "view" ] });
        });
});
