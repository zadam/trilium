import type { ToggleInParentResponse } from "@triliumnext/commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FBranch from "../entities/fbranch";
import type FNote from "../entities/fnote";
import froca from "../services/froca";
import { buildNote } from "../test/easy-froca";
import type { ContextMenuEvent, MenuItem } from "./context_menu";
import { showLauncherContextMenu } from "./launcher_button_context_menu";

const mocks = vi.hoisted(() => ({
    show: vi.fn(),
    put: vi.fn(async (_url: string): Promise<ToggleInParentResponse> => ({ success: true })),
    moveToParentNote: vi.fn(),
    showError: vi.fn()
}));

vi.mock("./context_menu", () => ({ default: { show: mocks.show } }));
vi.mock("../components/app_context", () => ({ default: {} }));
vi.mock("../services/server", () => ({ default: { put: mocks.put } }));
vi.mock("../services/toast", () => ({ default: { showError: mocks.showError } }));
vi.mock("../services/branches", () => ({ default: { moveToParentNote: mocks.moveToParentNote } }));
vi.mock("../services/options", () => ({ default: { get: () => "vertical" } }));
vi.mock("../services/i18n", () => ({ t: (key: string) => key }));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Remove from launch bar", () => {
    /** A note dropped onto the launch bar that is also bookmarked. */
    function bookmarkedLauncher() {
        buildNote({
            id: "_lbVisibleLaunchers",
            title: "Visible Launchers",
            children: [ { id: "dropped", title: "Dropped" } ]
        });
        const note = froca.notes["dropped"];
        froca.branches["_lbBookmarks_dropped"] = new FBranch(froca, {
            branchId: "_lbBookmarks_dropped",
            noteId: "dropped",
            parentNoteId: "_lbBookmarks",
            notePosition: 0,
            fromSearchNote: false
        });
        note.addParent("_lbBookmarks", "_lbBookmarks_dropped", false);
        return note;
    }

    async function remove(note: FNote, parentNoteId?: string) {
        const event = { pageX: 0, pageY: 0, preventDefault: () => {} } as ContextMenuEvent;
        await showLauncherContextMenu(note, event, { parentNoteId });
        const { items, selectMenuItemHandler } = mocks.show.mock.lastCall?.[0] ?? {};
        const removeTitle = "launcher_button_context_menu.remove_from_launch_bar";
        const removeItem = (items as MenuItem<string>[])
            .find((item) => "title" in item && item.title === removeTitle);
        expect(removeItem).toBeDefined();
        selectMenuItemHandler(removeItem);
    }

    it("removes the placement of the button that was clicked", async () => {
        const note = bookmarkedLauncher();

        // A dropped note is a clone, so the clone goes instead of moving to the available launchers.
        await remove(note, "_lbVisibleLaunchers");
        await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledExactlyOnceWith(
            "notes/dropped/toggle-in-parent/_lbVisibleLaunchers/false"
        ));

        // A bookmark button names no section, so the bookmark goes.
        await remove(note);
        await vi.waitFor(() => expect(mocks.put).toHaveBeenLastCalledWith(
            "notes/dropped/toggle-in-parent/_lbBookmarks/false"
        ));
        expect(mocks.put).toHaveBeenCalledTimes(2);
        expect(mocks.moveToParentNote).not.toHaveBeenCalled();
    });

    it("moves a launcher or a note placed only there to the available launchers", async () => {
        buildNote({
            id: "_lbVisibleLaunchers",
            title: "Visible Launchers",
            children: [
                { id: "launcher", title: "Launcher", type: "launcher" },
                { id: "onlyHere", title: "Only here" }
            ]
        });

        await remove(froca.notes["launcher"], "_lbVisibleLaunchers");
        await vi.waitFor(() => expect(mocks.moveToParentNote).toHaveBeenCalledExactlyOnceWith(
            [ "_lbVisibleLaunchers_launcher" ], "_lbRoot__lbAvailableLaunchers"
        ));
        expect(mocks.put).not.toHaveBeenCalled();

        // The server refuses to remove the last placement of a note.
        mocks.put.mockResolvedValueOnce({ success: false, message: "would delete the note" });
        await remove(froca.notes["onlyHere"], "_lbVisibleLaunchers");
        await vi.waitFor(() => expect(mocks.moveToParentNote).toHaveBeenLastCalledWith(
            [ "_lbVisibleLaunchers_onlyHere" ], "_lbRoot__lbAvailableLaunchers"
        ));
        expect(mocks.put).toHaveBeenCalledExactlyOnceWith(
            "notes/onlyHere/toggle-in-parent/_lbVisibleLaunchers/false"
        );
        expect(mocks.showError).not.toHaveBeenCalled();
    });
});
