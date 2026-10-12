import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildNote } from "../test/easy-froca";
import { endLivePrint, printLiveInBrowser, startLivePrint } from "./live_print";

function addThemeLink(href: string, media?: string) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    if (media) link.media = media;
    link.setAttribute("data-theme-stylesheet", "true");
    document.head.appendChild(link);
    return link;
}

describe("live print", () => {
    beforeEach(() => {
        // Let happy-dom report the stylesheets it does not fetch as loaded.
        const happyDOM = (window as any).happyDOM;
        happyDOM.settings.disableCSSFileLoading = true;
        happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
        (document as any).fonts = { ready: Promise.resolve() };
    });

    afterEach(() => {
        endLivePrint();
        for (const link of document.head.querySelectorAll("link")) link.remove();
        document.body.replaceChildren();
    });

    it("marks the target, prints the light baseline and applies printCss, then restores everything", async () => {
        const plainTheme = addThemeLink("theme-dark.css");
        const autoTheme = addThemeLink("theme-next-dark.css", "(prefers-color-scheme: dark)");
        const css = buildNote({ id: "live-css", title: "CSS", type: "code" });
        const text = buildNote({ id: "live-text", title: "Not CSS", type: "text" });
        const note = buildNote({ id: "live-host", title: "Host", type: "render" });
        note.getRelationTargets = async () => [ css, text ];
        const target = document.createElement("div");
        document.body.appendChild(target);

        await startLivePrint(note, target);

        expect(document.body.classList.contains("print-live")).toBe(true);
        expect(target.classList.contains("print-live-target")).toBe(true);
        expect(plainTheme.media).toBe("screen");
        expect(autoTheme.media).toBe("screen and (prefers-color-scheme: dark)");
        const printCss = [ ...document.head.querySelectorAll<HTMLLinkElement>("link[data-live-print-css]") ];
        expect(printCss.map((link) => [ link.getAttribute("href"), link.media ])).toEqual([ [ "api/notes/live-css/download", "print" ] ]);

        endLivePrint();

        expect(document.body.classList.contains("print-live")).toBe(false);
        expect(target.classList.contains("print-live-target")).toBe(false);
        expect(plainTheme.media).toBe("");
        expect(autoTheme.media).toBe("(prefers-color-scheme: dark)");
        expect(plainTheme.hasAttribute("data-live-print-media")).toBe(false);
        expect(document.head.querySelector("link[data-live-print-css]")).toBeNull();
    });

    it("keeps a single target when a second live print starts before the first ended", async () => {
        const theme = addThemeLink("theme-dark.css");
        const note = buildNote({ id: "live-twice", title: "Twice", type: "render" });
        const first = document.createElement("div");
        const second = document.createElement("div");
        document.body.append(first, second);

        await startLivePrint(note, first);
        await startLivePrint(note, second);

        expect(first.classList.contains("print-live-target")).toBe(false);
        expect(second.classList.contains("print-live-target")).toBe(true);
        expect(theme.media).toBe("screen");
    });

    it("prints through the browser dialog and restores the window afterwards", async () => {
        const note = buildNote({ id: "live-browser", title: "Browser", type: "render" });
        const target = document.createElement("div");
        document.body.appendChild(target);
        const print = vi.fn(() => {
            expect(target.classList.contains("print-live-target")).toBe(true);
        });
        window.print = print;

        await printLiveInBrowser(note, target);
        expect(print).toHaveBeenCalledOnce();
        expect(target.classList.contains("print-live-target")).toBe(true);

        window.dispatchEvent(new Event("afterprint"));
        expect(target.classList.contains("print-live-target")).toBe(false);
    });
});
