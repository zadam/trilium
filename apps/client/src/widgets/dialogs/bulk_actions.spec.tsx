import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../../components/component";
import { buildNote } from "../../test/easy-froca";
import { renderInto } from "../../test/render";
import { ParentComponent } from "../react/react_utils";
import BulkActionsDialog from "./bulk_actions";

const server = vi.hoisted(() => ({
    get: vi.fn(async () => []),
    post: vi.fn()
}));

vi.mock("../../services/i18n", async (importOriginal) => ({
    ...await importOriginal<typeof import("../../services/i18n")>(),
    t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key)
}));
vi.mock("../../services/server", () => ({ default: server }));
vi.mock("../react/NoteLink", () => ({
    default: ({ notePath }: { notePath: string }) => <span className="note-link">{notePath}</span>
}));

describe("BulkActionsDialog", () => {
    let host: Component;
    let container: HTMLElement;

    beforeEach(() => {
        vi.clearAllMocks();
        server.post.mockResolvedValue({ affectedNoteCount: 0 });
        buildNote({ id: "_bulkAction", title: "Bulk action" });
        host = new Component();
        container = renderInto(
            <ParentComponent.Provider value={host}>
                <BulkActionsDialog />
            </ParentComponent.Provider>
        );
    });

    async function open(selectedOrActiveNoteIds: string[]) {
        await act(async () => {
            await host.handleEventInChildren("openBulkActionsDialog", { selectedOrActiveNoteIds });
        });
    }

    function chipNoteIds() {
        return [ ...container.querySelectorAll(".bulk-actions-selected-notes .tn-chip .note-link") ]
            .map((el) => el.textContent);
    }

    function lastAffectedNotesRequest() {
        return server.post.mock.calls.filter(([ url ]) => url === "bulk-action/affected-notes").at(-1)?.[1];
    }

    it("shows the first selected notes as chips and the rest on demand", async () => {
        const noteIds = [ "n1", "n2", "n3", "n4", "n5", "n6", "n7" ];
        await open(noteIds);
        expect(chipNoteIds()).toStrictEqual([ "n1", "n2", "n3", "n4", "n5" ]);

        const more = container.querySelector<HTMLElement>(".bulk-actions-selected-notes .bulk-actions-more-notes");
        expect(more?.textContent).toBe("bulk_actions.more_notes:2");
        await act(async () => more?.click());

        expect(chipNoteIds()).toStrictEqual(noteIds);
        expect(container.querySelector(".bulk-actions-more-notes")).toBeNull();
    });

    it("says so when no action is chosen yet", async () => {
        await open([ "n1" ]);
        expect(container.querySelector(".bulk-actions-chosen-actions .no-items")?.textContent)
            .toBe("bulk_actions.none_yet");
    });

    it("drops a removed chip from the notes the actions apply to, keeping the last one", async () => {
        await open([ "n1", "n2" ]);
        expect(lastAffectedNotesRequest()).toStrictEqual({ noteIds: [ "n1", "n2" ], includeDescendants: false });

        const removeButtons = container.querySelectorAll<HTMLButtonElement>(".bulk-actions-selected-notes .tn-chip-remove");
        expect(removeButtons).toHaveLength(2);
        await act(async () => removeButtons[0].click());

        expect(chipNoteIds()).toStrictEqual([ "n2" ]);
        expect(lastAffectedNotesRequest()).toStrictEqual({ noteIds: [ "n2" ], includeDescendants: false });
        expect(container.querySelector<HTMLButtonElement>(".tn-chip-remove")?.disabled).toBe(true);
    });
});
