import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

import FNote from "../../entities/fnote";
import { ViewScope } from "../../services/link";

// The badge reads the note being shown and the view it is shown in, neither of which a rendered
// widget brings with it.
const shownNote = vi.hoisted(() => ({ current: null as FNote | null, viewScope: undefined as ViewScope | undefined }));
vi.mock("../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks")>()),
    useNoteContext: () => ({
        note: shownNote.current,
        viewScope: shownNote.viewScope
    })
}));

// i18next is not initialized under test, where t() answers with an empty string; echoing the key
// back keeps the assertions about which wording the badge picks.
vi.mock("../../services/i18n", () => ({
    t: (key: string) => key
}));

import { buildNote } from "../../test/easy-froca";
import { renderInto } from "../../test/render";
import { ClippedNoteBadge, ExecuteBadge, getShareScope, OfficePreviewBadge } from "./NoteBadges";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("OfficePreviewBadge", () => {
    it("marks a file note that the office preview renders", () => {
        const badge = renderBadge({ type: "file", mime: DOCX_MIME });

        expect(badge?.textContent).toBe("breadcrumb_badges.office_preview");
        expect(badge?.querySelector(".bx-show")).not.toBeNull();
    });

    it("stays away from files without an office preview, and from office MIME types on other note types", () => {
        expect(renderBadge({ type: "file", mime: "application/pdf" })).toBeNull();
        // A text note keeps its own editor, whatever MIME it carries.
        expect(renderBadge({ type: "text", mime: DOCX_MIME })).toBeNull();
    });

    it("stays away from views that show something other than the preview", () => {
        expect(renderBadge({ type: "file", mime: DOCX_MIME }, { viewMode: "attachments" })).toBeNull();
        // A context without a view mode is on the note itself, which is where the preview renders.
        expect(renderBadge({ type: "file", mime: DOCX_MIME }, undefined)).not.toBeNull();
    });

    function renderBadge(noteDef: { type: "file" | "text", mime: string }, viewScope: ViewScope | undefined = { viewMode: "default" }) {
        shownNote.current = buildNote({ title: "Document", ...noteDef });
        shownNote.viewScope = viewScope;
        return renderInto(<OfficePreviewBadge />).querySelector(".office-preview-badge");
    }
});

describe("ExecuteBadge", () => {
    it("titles the button with #executeTitle or the value of #executeButton, falling back to the wording for the note's language", () => {
        expect(renderBadge({ "#executeButton": "", "#executeTitle": "Deploy" })?.textContent).toBe("Deploy");
        expect(renderBadge({ "#executeButton": "Create launcher" })?.textContent).toBe("Create launcher");
        expect(renderBadge({ "#executeButton": "true", "#executeTitle": "Deploy" })?.textContent).toBe("Deploy");
        expect(renderBadge({ "#executeButton": "true" })?.textContent).toBe("breadcrumb_badges.execute_script");
        expect(renderBadge({ "#executeButton": "" })?.textContent).toBe("breadcrumb_badges.execute_script");
        expect(renderBadge({ "#executeDescription": "Rebuilds the index" })?.textContent).toBe("breadcrumb_badges.execute_script");
        expect(renderBadge({})).toBeNull();
    });

    function renderBadge(labels: Record<`#${string}`, string>) {
        shownNote.current = buildNote({ title: "Script", type: "code", mime: "application/javascript;env=frontend", ...labels });
        return renderInto(<ExecuteBadge />).querySelector(".execute-badge .text");
    }
});

describe("ClippedNoteBadge", () => {
    const PAGE_URL = "https://www.example.com/articles/1";

    it("links straight to the page when the clipping carries nothing more about it", () => {
        const badge = renderBadge({ "#pageUrl": PAGE_URL });

        expect(badge.querySelector(".clipped-note-badge a")?.getAttribute("href")).toBe(PAGE_URL);
        expect(badge.querySelector(".dropdown-clipped-note-badge")).toBeNull();
    });

    it("opens the details of the page it was clipped from, leaving out what the page did not give", async () => {
        const details = await openDetails({
            "#pageUrl": PAGE_URL,
            "#pageDescription": "First line\nSecond line",
            "#pageAuthor": "Ada Lovelace",
            "#publishedDate": "2024-05-01"
        });

        const source = details.querySelector<HTMLAnchorElement>(".clipped-note-source a");
        expect(source?.getAttribute("href")).toBe(PAGE_URL);
        expect(source?.target).toBe("_blank");
        expect(source?.textContent).toBe("www.example.com");
        expect(details.querySelector(".clipped-note-description")?.textContent).toBe("First line\nSecond line");
        expect(fields(details)).toEqual([
            [ "breadcrumb_badges.clipped_note_author", "Ada Lovelace" ],
            [ "breadcrumb_badges.clipped_note_published", "2024-05-01" ]
        ]);
    });

    it("stays open for a click inside, so its text can be selected", async () => {
        const details = await openDetails({ "#pageUrl": PAGE_URL, "#pageAuthor": "Ada Lovelace" });

        act(() => details.querySelector("dd")?.click());
        await new Promise((resolve) => setTimeout(resolve));
        expect(document.querySelector(".tn-popup .clipped-note-details")).not.toBeNull();
    });

    it("lists the dates of a page that has no description", async () => {
        const details = await openDetails({ "#pageUrl": PAGE_URL, "#modifiedDate": "2024-06-12" });

        expect(details.querySelector(".clipped-note-description")).toBeNull();
        expect(fields(details)).toEqual([ [ "breadcrumb_badges.clipped_note_modified", "2024-06-12" ] ]);
    });

    function renderBadge(labels: Record<`#${string}`, string>) {
        shownNote.current = buildNote({ title: "Clipping", ...labels });
        shownNote.viewScope = undefined;
        return renderInto(<ClippedNoteBadge />);
    }

    async function openDetails(labels: Record<`#${string}`, string>) {
        const toggle = renderBadge(labels).querySelector<HTMLButtonElement>(".dropdown-clipped-note-badge button");
        expect(toggle).not.toBeNull();
        act(() => {
            toggle?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            toggle?.click();
        });
        return await vi.waitFor(() => {
            const details = document.querySelector<HTMLElement>(".tn-popup .clipped-note-details");
            if (!details) throw new Error("expected the details panel to open");
            return details;
        });
    }

    function fields(details: HTMLElement) {
        return [ ...details.querySelectorAll(".clipped-note-fields > div") ].map((field) => [
            field.querySelector("dt")?.textContent,
            field.querySelector("dd")?.textContent
        ]);
    }
});

describe("getShareScope", () => {
    it("tells a public share from a local one, a standalone preview and one only an export publishes", () => {
        const syncServerHost = "https://sync.example.com";
        const platform = { isElectron: false, isStandalone: false, isMobileApp: false };

        expect(getShareScope({ ...platform, syncServerHost: "" })).toBe("public");
        expect(getShareScope({ ...platform, isElectron: true, syncServerHost: "" })).toBe("local");
        expect(getShareScope({ ...platform, isElectron: true, syncServerHost })).toBe("public");
        expect(getShareScope({ ...platform, isStandalone: true, syncServerHost: "" })).toBe("preview");
        expect(getShareScope({ ...platform, isStandalone: true, syncServerHost })).toBe("public");
        expect(getShareScope({ ...platform, isStandalone: true, isMobileApp: true, syncServerHost: "" })).toBe("export-only");
        expect(getShareScope({ ...platform, isStandalone: true, isMobileApp: true, syncServerHost })).toBe("public");
    });
});
