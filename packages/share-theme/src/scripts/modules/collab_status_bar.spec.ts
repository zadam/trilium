// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { setupStatusBar, type StatusBarBootstrap } from "./collab_status_bar.js";

const STRINGS = {
    note_path: "Note path", tab_width_title: "Change tab width",
    tab_width_spaces_short: "Spaces: {{width}}", tab_width_tabs: "Tabs: {{width}}",
    tab_width_style_header: "Indent using", tab_width_style_spaces: "Spaces",
    tab_width_style_tabs: "Tabs", tab_width_display_header: "Display width",
    tab_width_reindent_header: "Re-indent content to",
    tab_width_1: "1 space", tab_width_2: "2 spaces", tab_width_3: "3 spaces",
    tab_width_4: "4 spaces", tab_width_6: "6 spaces", tab_width_8: "8 spaces",
    note_info: "Note info", info_created: "Created", info_modified: "Modified", info_type: "Type",
    info_mime: "MIME type", info_note_id: "Note ID", info_note_size: "Note size",
    info_note_size_hint: "Rough size", info_calculate: "calculate"
};

function page(noteId: string) {
    document.body.innerHTML = `<nav id="menu"><ul><li class="item expanded">
            <a href="./" data-note-id="root"><span><i class="bx bx-folder"></i> Shared</span></a>
            <ul><li class="item expanded"><a href="./n1" data-note-id="n1">
                <span><i></i> Middle</span></a>
                <ul><li class="item"><a href="./n2" data-note-id="n2">
                    <span><i></i> Leaf</span></a></li></ul>
            </li></ul></li></ul></nav>
        <footer id="collab-status-bar"><nav class="collab-breadcrumb"></nav>
            <div class="collab-status-bar-end"></div></footer>`;
    const bootstrap: StatusBarBootstrap = {
        noteId, type: "code", editable: true, capabilities: [ "view", "edit" ],
        csrfToken: "csrf", indentation: { width: 4, useTabs: false }, strings: STRINGS,
        mime: "text/x-python", typeLabel: "Code", typeIcon: "bx bx-code",
        utcDateCreated: "2026-10-01T21:03:17.000Z", utcDateModified: "2026-10-02T15:12:57.000Z"
    };
    return bootstrap;
}

function crumbs() {
    return [ ...document.querySelectorAll<HTMLAnchorElement>(".collab-breadcrumb a") ]
        .map((link) => [ link.textContent, link.getAttribute("href") ]);
}

describe("setupStatusBar", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows the path from the shared note down to the open one, and follows navigation", () => {
        const bootstrap = page("n2");
        const events = new EventTarget();
        setupStatusBar(bootstrap, events);

        expect(crumbs()).toEqual([
            [ "Shared", "./" ], [ "Middle", "./n1" ], [ "Leaf", "./n2" ]
        ]);
        // The shared note leads with the home icon, as the app's root does.
        expect(document.querySelector(".collab-breadcrumb a .bx")?.className)
            .toBe("bx bx-home-alt");

        bootstrap.noteId = "n1";
        events.dispatchEvent(new CustomEvent("collab-navigated", { detail: {} }));
        expect(crumbs()).toEqual([ [ "Shared", "./" ], [ "Middle", "./n1" ] ]);
    });

    it("sets a code note's indentation from its menu, and re-indents through the editor", () => {
        const bootstrap = page("n2");
        const events = new EventTarget();
        const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
            ok: true, json: async () => JSON.parse(String(init.body))
        }));
        vi.stubGlobal("fetch", fetchMock);
        const applied: unknown[] = [];
        const reindented: unknown[] = [];
        events.addEventListener("collab-indentation", (event) =>
            applied.push((event as CustomEvent).detail));
        events.addEventListener("collab-reindent", (event) =>
            reindented.push((event as CustomEvent).detail));
        setupStatusBar(bootstrap, events);

        const button = document.querySelector<HTMLButtonElement>(".collab-indentation");
        expect(button?.textContent).toBe("Spaces: 4");
        button?.click();
        const rows = () => [ ...document.querySelectorAll<HTMLButtonElement>(
            ".collab-menu .collab-menu-item") ];
        expect([ ...document.querySelectorAll(".collab-menu-header") ]
            .map((header) => header.textContent))
            .toEqual([ "Indent using", "Display width", "Re-indent content to" ]);
        // The width shown now is no width to re-indent to.
        expect(rows().filter((row) => row.getAttribute("aria-disabled") === "true")
            .map((row) => row.textContent)).toEqual([ "4 spaces" ]);

        rows().find((row) => row.textContent === "2 spaces")?.click();
        expect(applied).toEqual([ { width: 2, useTabs: false } ]);
        expect(document.querySelector(".collab-indentation")?.textContent).toBe("Spaces: 2");
        const [ url, init ] = fetchMock.mock.calls[0];
        expect(url).toBe("api/notes/n2/indentation");
        expect(JSON.parse(String(init.body))).toEqual({ width: 2 });

        document.querySelector<HTMLButtonElement>(".collab-indentation")?.click();
        rows().filter((row) => row.textContent === "Tabs").at(-1)?.click();
        expect(reindented).toEqual([ {
            from: { width: 2, useTabs: false }, to: { width: 2, useTabs: true }
        } ]);
        expect(document.querySelector(".collab-indentation")?.textContent).toBe("Tabs: 2");
    });

    it("shows a viewer the indentation without a menu, and no control for other notes", () => {
        const bootstrap = { ...page("n2"), capabilities: [ "view" ], csrfToken: null };
        setupStatusBar(bootstrap, new EventTarget());
        const shown = document.querySelector(".collab-indentation");
        expect(shown?.tagName).toBe("SPAN");
        expect(shown?.textContent).toBe("Spaces: 4");

        for (const type of [ "text", "mermaid", "canvas" ]) {
            setupStatusBar({ ...page("n2"), type, indentation: null }, new EventTarget());
            expect(document.querySelector(".collab-indentation"), type).toBeNull();
        }
    });

    it("shows the note's info at the end of the bar, and its size once asked for", async () => {
        const bootstrap = page("n2");
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ noteSize: 1536 }) }));
        vi.stubGlobal("fetch", fetchMock);
        setupStatusBar(bootstrap, new EventTarget());

        const button = document.querySelector<HTMLButtonElement>(".collab-note-info-button");
        expect(document.querySelector(".collab-status-bar-end")?.lastElementChild).toBe(button);
        expect(button?.getAttribute("aria-label")).toBe("Note info");
        button?.click();

        const panel = document.querySelector(".collab-note-info-panel");
        const rows = () => [ ...panel?.querySelectorAll("dt") ?? [] ].map((term) =>
            [ term.textContent, term.nextElementSibling?.textContent ]);
        expect(rows().map(([ term ]) => term)).toEqual([
            "Created:", "Modified:", "Type:", "MIME type:", "Note ID:", "Note size:"
        ]);
        expect(rows()[2]?.[1]?.trim()).toBe("Code");
        expect(rows()[3]?.[1]).toBe("text/x-python");
        expect(rows()[4]?.[1]).toBe("n2");
        expect(new Date(String(rows()[0]?.[1])).getFullYear()).toBe(2026);
        expect(fetchMock).not.toHaveBeenCalled();

        panel?.querySelector<HTMLButtonElement>(".collab-info-calculate")?.click();
        await vi.waitFor(() => expect(rows()[5]?.[1]).toBe("1.5 KiB"));
        expect(fetchMock).toHaveBeenCalledWith("api/notes/n2/size", expect.anything());

        // A press anywhere else closes it.
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        expect(document.querySelector(".collab-note-info-panel")).toBeNull();
    });
});
