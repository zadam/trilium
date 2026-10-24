import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import type NoteContext from "../../components/note_context";
import type { MenuCommandItem } from "../../menus/context_menu";
import protectedSessionHolder from "../../services/protected_session_holder";
import { buildNote } from "../../test/easy-froca";
import { renderInto } from "../../test/render";
import { BreadcrumbNoteTitle, buildChildNoteItems, noteTitleHtml } from "./Breadcrumb";

vi.mock("../../services/i18n", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../services/i18n")>()),
    t: (key: string) => key
}));

describe("BreadcrumbNoteTitle", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderTitle(isProtected: boolean, isUnlocked: boolean) {
        vi.spyOn(protectedSessionHolder, "isProtectedSessionAvailable").mockReturnValue(isUnlocked);
        const note = buildNote({ title: "R&D" });
        note.isProtected = isProtected;

        let container: HTMLElement | undefined;
        act(() => {
            container = renderInto(<BreadcrumbNoteTitle note={note} />);
        });
        return container;
    }

    it("reads Protected with a lock while the protected session is locked", () => {
        const container = renderTitle(true, false);
        const label = container?.querySelector(".protected-title");
        expect(label?.textContent).toBe("protected_session.locked_note_title");
        expect(container?.textContent).not.toContain("R&D");
        expect(container?.lastElementChild?.matches(".protected-icon.bx-lock-alt")).toBe(true);
    });

    it("ends the note's own title with a lock inside the protected session", () => {
        const container = renderTitle(true, true);
        expect(container?.textContent).toBe("R&D");
        expect(container?.querySelector(".protected-title")).toBeNull();
        expect(container?.lastElementChild?.matches(".protected-icon.bx-lock-alt")).toBe(true);
    });

    it("draws no lock for an unprotected note", () => {
        expect(renderTitle(false, false)?.querySelector(".protected-icon")).toBeNull();
    });
});

describe("noteTitleHtml", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("escapes the title, and reads Protected with a lock while the session is locked", () => {
        const note = buildNote({ title: "R&D <b>" });
        expect(noteTitleHtml(note)).toBe("R&amp;D &lt;b&gt;");

        note.isProtected = true;
        const lock = `<span class="bx bx-lock-alt protected-icon tn-icon"></span>`;
        vi.spyOn(protectedSessionHolder, "isProtectedSessionAvailable").mockReturnValue(true);
        expect(noteTitleHtml(note)).toBe(`R&amp;D &lt;b&gt;${lock}`);
        vi.spyOn(protectedSessionHolder, "isProtectedSessionAvailable").mockReturnValue(false);
        const locked = `<span class="protected-title">protected_session.locked_note_title</span>`;
        expect(noteTitleHtml(note)).toBe(`${locked}${lock}`);
    });
});

describe("buildChildNoteItems", () => {
    const children = () => [
        buildNote({ id: "_hidden", title: "Hidden" }),
        buildNote({ id: "rnd", title: "R&D" }),
        buildNote({ id: "old", title: "Old", "#archived": "" })
    ];
    const titles = (items: ReturnType<typeof buildChildNoteItems>) =>
        items.map((item) => ("title" in item ? item.title : item.kind));

    it("lists the children in order, the one on the path in bold, then a create row", () => {
        const setNote = vi.fn();
        const noteContext = { setNote } as unknown as NoteContext;
        const items = buildChildNoteItems(children(), {
            notePath: "root/parent", activeNotePath: "root/parent/rnd",
            noteContext, hideArchivedNotes: false
        });
        expect(titles(items)).toEqual([
            "<strong>R&amp;D</strong>", "Old", "separator", "breadcrumb.create_new_note"
        ]);
        expect(items[1]).toMatchObject({ className: "archived" });

        const first = items[0] as MenuCommandItem<unknown>;
        first.handler?.(first, new MouseEvent("click"));
        expect(setNote).toHaveBeenCalledWith("root/parent/rnd");
    });

    it("leaves out hidden archived notes, and the separator once no child is left", () => {
        const props = { notePath: "root/parent", noteContext: undefined, hideArchivedNotes: true };
        expect(titles(buildChildNoteItems(children(), props)))
            .toEqual([ "R&amp;D", "separator", "breadcrumb.create_new_note" ]);
        expect(titles(buildChildNoteItems(children().slice(2), props)))
            .toEqual([ "breadcrumb.create_new_note" ]);
    });
});
