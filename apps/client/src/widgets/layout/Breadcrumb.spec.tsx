import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import protectedSessionHolder from "../../services/protected_session_holder";
import { buildNote } from "../../test/easy-froca";
import { renderInto } from "../../test/render";
import { BreadcrumbNoteTitle } from "./Breadcrumb";

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
