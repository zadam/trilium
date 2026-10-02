import { t } from "i18next";
import { describe, expect, it } from "vitest";

import { getContext } from "../services/context.js";
import type { CollabClientInfo } from "../services/messaging/types.js";
import noteService from "../services/notes.js";
import {
    allowCursorMessage, buildCollabPeople, collabPersonId, expireHostViews, getHostViewers,
    recordHostView, revokeCollabGuest
} from "./presence.js";
import collabService from "./service.js";

function startCollab() {
    const { note } = getContext().init(() => noteService.createNewNote({
        parentNoteId: "root", title: "presence", content: "", type: "text"
    }));

    return getContext().init(() => collabService.createCollaboration(note.noteId, {
        includeSubtree: false, viewMode: "open", editMode: "open", createMode: "none"
    }));
}

function page(guestId: string): CollabClientInfo {
    return {
        guestId, unlocked: [], name: null, color: null, viewingNoteId: null, editingNoteId: null,
        isHost: false
    };
}

describe("collaboration presence", () => {
    it("gives a guest an id per collaboration that never shows their guest id", () => {
        const id = collabPersonId("c1", "guest-secret");

        expect(id).toMatch(/^[A-Za-z0-9_-]{16}$/);
        expect(collabPersonId("c1", "guest-secret")).toBe(id);
        expect(collabPersonId("c2", "guest-secret")).not.toBe(id);
        expect(collabPersonId("c1", "other-guest")).not.toBe(id);
    });

    it("numbers guests from one, keeping a number through a reload for two minutes", async () => {
        const collab = await startCollab();
        const collabId = collab.collabId ?? "";
        const people = (guests: string[], now: number) =>
            buildCollabPeople(collab, guests.map(page), now)
                .map((person) => [ person.id, person.name ]);
        const guest = (guestId: string, number: number) =>
            [ collabPersonId(collabId, guestId), t("collab_theme.guest_name", { number }) ];

        expect(people([ "a", "b" ], 0)).toEqual([ guest("a", 1), guest("b", 2) ]);

        // While "a" reloads, a newcomer does not take their number.
        expect(people([ "b" ], 1000)).toEqual([ guest("b", 2) ]);
        expect(people([ "b", "c" ], 2000)).toEqual([ guest("b", 2), guest("c", 3) ]);
        expect(people([ "a", "b", "c" ], 3000))
            .toEqual([ guest("a", 1), guest("b", 2), guest("c", 3) ]);

        // Two minutes after "a" left, the next newcomer gets the number.
        expect(people([ "b", "c" ], 4000)).toEqual([ guest("b", 2), guest("c", 3) ]);
        expect(people([ "b", "c", "d" ], 4000 + 2 * 60 * 1000))
            .toEqual([ guest("d", 1), guest("b", 2), guest("c", 3) ]);

        // A removed guest's number is free at once.
        revokeCollabGuest(collabId, "b");
        expect(people([ "c", "d", "e" ], 200_000))
            .toEqual([ guest("d", 1), guest("e", 2), guest("c", 3) ]);
    });

    it("tells which notes gain or lose the host as the app's view moves or goes stale", () => {
        expect(recordHostView("app-1", "n1", 0)).toEqual([ "n1" ]);
        expect(recordHostView("app-1", "n1", 1000)).toEqual([]);
        expect(getHostViewers("n1", 1000)).toEqual([ "app-1" ]);
        expect(recordHostView("app-1", "n2", 2000)).toEqual([ "n1", "n2" ]);
        expect(getHostViewers("n1", 2000)).toEqual([]);

        expect(expireHostViews(6999)).toEqual([]);
        expect(getHostViewers("n2", 6999)).toEqual([ "app-1" ]);
        expect(expireHostViews(7000)).toEqual([ "n2" ]);
        expect(getHostViewers("n2", 7000)).toEqual([]);

        // A view that went stale before the app named another note leaves no list to update.
        expect(recordHostView("app-2", "n3", 10_000)).toEqual([ "n3" ]);
        expect(recordHostView("app-2", "n4", 20_000)).toEqual([ "n4" ]);
        expect(recordHostView("app-2", null, 21_000)).toEqual([ "n4" ]);
        expect(recordHostView("app-2", null, 22_000)).toEqual([]);
    });

    it("lets each client send twenty cursor messages a second", () => {
        for (let i = 0; i < 20; i++) {
            expect(allowCursorMessage("cursor-client", 1000 + i)).toBe(true);
        }

        expect(allowCursorMessage("cursor-client", 1500)).toBe(false);
        expect(allowCursorMessage("other-client", 1500)).toBe(true);
        expect(allowCursorMessage("cursor-client", 2000)).toBe(true);
    });
});
