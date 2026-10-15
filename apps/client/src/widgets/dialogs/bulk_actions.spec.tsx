import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../../components/component";
import bulk_action from "../../services/bulk_action";
import noteAttributeCache from "../../services/note_attribute_cache";
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
        delete noteAttributeCache.attributes._bulkAction;
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

    it("adds the action picked from the add menu at the foot of the actions card", async () => {
        await open([ "n1" ]);
        const toggle = container.querySelector<HTMLButtonElement>(".bulk-actions-chosen-actions .tn-card-section:last-child .dropdown button");
        expect(toggle?.textContent).toContain("bulk_actions.add_action");
        await act(async () => toggle?.click());

        const item = [ ...document.querySelectorAll<HTMLElement>(".action-add-menu .dropdown-item") ]
            .find((el) => el.textContent?.includes("move_note.move_note"));
        expect(item).toBeDefined();
        expect(item?.querySelector(".bx-note.bulk-action-marker-move")).not.toBeNull();
        expect(item?.getAttribute("title") ?? item?.getAttribute("data-bs-original-title"))
            .toBe("move_note.description");
        await act(async () => item?.click());

        expect(server.post).toHaveBeenCalledWith("notes/_bulkAction/attributes", {
            type: "label",
            name: "action",
            value: JSON.stringify({ name: "moveNote" })
        });
    });

    it("marks each chosen action with its icon", async () => {
        buildNote({ id: "_bulkAction", title: "Bulk action", "#action": JSON.stringify({ name: "deleteNote" }) });
        await open([ "n1" ]);
        expect(container.querySelectorAll(".bulk-existing-action-list tr")).toHaveLength(1);

        const icon = container.querySelector(".bulk-existing-action-list .bulk-action-icon");
        expect(icon?.classList.contains("bx-note")).toBe(true);
        expect(icon?.classList.contains("bulk-action-marker-delete")).toBe(true);
        expect(icon?.classList.contains("destructive-action-icon")).toBe(true);
        expect(container.querySelector(".bulk-existing-action-list .tn-chip-remove, .bulk-existing-action-list .search-option-del"))
            .not.toBeNull();
        expect(container.querySelector(".bulk-existing-action-list .help-dropdown")).toBeNull();
    });

    it("names each chosen action by its menu title alone, with an arrow only between two fields", async () => {
        buildNote({
            id: "_bulkAction",
            title: "Bulk action",
            "#action": bulk_action.ACTION_CLASSES.map(({ actionName }) => JSON.stringify({ name: actionName }))
        });
        await open([ "n1" ]);
        const rows = [ ...container.querySelectorAll<HTMLTableRowElement>(".bulk-existing-action-list tr") ];
        expect(rows).toHaveLength(bulk_action.ACTION_CLASSES.length);

        for (const [ index, ActionClass ] of bulk_action.ACTION_CLASSES.entries()) {
            const row = rows[index];
            const content = row.cells[0].cloneNode(true) as HTMLElement;
            for (const field of content.querySelectorAll("select, .template-field")) field.remove();
            expect(content.textContent?.trim(), ActionClass.actionName).toBe(ActionClass.actionTitle);
            expect(row.querySelectorAll(".tn-icon:not(.bulk-action-arrow)"), ActionClass.actionName).toHaveLength(1);

            const arrow = row.querySelector(".bulk-action-arrow");
            const fieldCount = row.querySelectorAll("input:not([type=hidden]), select, .template-field").length;
            expect(!!arrow, ActionClass.actionName).toBe(fieldCount === 2);
        }
    });

    it("names the note count on the execute button and enables it only with actions and notes to run on", async () => {
        function executeButton() {
            const button = container.querySelector<HTMLButtonElement>(".modal-footer button[name='execute-bulk-actions']");
            if (!button) throw new Error("No execute button.");
            return button;
        }

        server.post.mockResolvedValue({ affectedNoteCount: 3 });
        await open([ "n1", "n2" ]);
        expect(executeButton().textContent).toContain("bulk_actions.execute_bulk_actions:3");
        expect(executeButton().disabled).toBe(true);

        buildNote({ id: "_bulkAction", title: "Bulk action", "#action": JSON.stringify({ name: "deleteRevisions" }) });
        await open([ "n1", "n2" ]);
        expect(executeButton().disabled).toBe(false);

        server.post.mockResolvedValue({ affectedNoteCount: 0 });
        await open([ "gone" ]);
        expect(executeButton().textContent).toContain("bulk_actions.execute_bulk_actions:0");
        expect(executeButton().disabled).toBe(true);
    });

    it("runs the actions once, however often the execute button is pressed", async () => {
        buildNote({ id: "_bulkAction", title: "Bulk action", "#action": JSON.stringify({ name: "deleteRevisions" }) });
        server.post.mockResolvedValue({ affectedNoteCount: 1 });
        await open([ "n1" ]);

        let finish = () => {};
        server.post.mockImplementation((url: string) => (url === "bulk-action/execute"
            ? new Promise<void>((resolve) => { finish = resolve; })
            : Promise.resolve({ affectedNoteCount: 1 })));
        const form = container.querySelector("form");
        if (!form) throw new Error("The dialog has no form.");
        await act(async () => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });

        expect(server.post.mock.calls.filter(([ url ]) => url === "bulk-action/execute")).toHaveLength(1);
        expect(container.querySelector<HTMLButtonElement>("button[name='execute-bulk-actions']")?.disabled).toBe(true);
        await act(async () => finish());
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
