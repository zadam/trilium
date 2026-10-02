import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/mermaid.js", () => ({
    renderMermaidSvg: vi.fn(async (source: string) => `<svg>${source}</svg>`)
}));

import type { GuestSaver } from "../guest_saver.js";
import mountMermaidEditor, { createDiagramDrawer, mountDiagramViews } from "./mermaid_editor.js";

describe("createDiagramDrawer", () => {
    it("draws a source once per theme, and reports what Mermaid could not draw", async () => {
        const render = vi.fn(async (source: string, theme: string) => {
            if (source === "graph ??") {
                throw new Error("Parse error on line 1");
            }

            return `<svg class="${theme}">${source}</svg>`;
        });
        const draw = createDiagramDrawer(render);

        expect(await draw("graph TD", "dark"))
            .toEqual({ svg: "<svg class=\"dark\">graph TD</svg>", error: null });
        // The diagram beside the editor and the preview of the save share a drawing per theme.
        await draw("graph TD", "dark");
        expect(await draw("graph TD", "default"))
            .toEqual({ svg: "<svg class=\"default\">graph TD</svg>", error: null });
        await draw("graph TD", "default");
        expect(render).toHaveBeenCalledTimes(2);

        expect(await draw("graph ??", "dark"))
            .toEqual({ svg: null, error: "Parse error on line 1" });
        expect(render).toHaveBeenCalledTimes(3);
    });

    it("draws one diagram at a time, as Mermaid keeps one theme for the whole page", async () => {
        let running = 0;
        let overlapped = false;
        const render = vi.fn(async (source: string) => {
            running++;
            overlapped ||= running > 1;
            await new Promise((resolve) => setTimeout(resolve, 5));
            running--;
            return `<svg>${source}</svg>`;
        });
        const draw = createDiagramDrawer(render);

        await Promise.all([
            draw("graph A", "dark"), draw("graph A", "default"), draw("graph B", "dark")
        ]);
        expect(render).toHaveBeenCalledTimes(3);
        expect(overlapped).toBe(false);
    });
});

describe("mountDiagramViews", () => {
    const labels = { source: "Source view", split: "Split view", preview: "Preview" };

    beforeEach(() => {
        sessionStorage.clear();
        document.body.innerHTML = "<div class=\"collab-title-row\"><h1 id=\"title\">One</h1>"
            + "<button class=\"collab-note-options\"></button></div>";
    });

    it("puts the app's three modes beside the note options, split until another is picked", () => {
        const host = document.createElement("div");
        document.body.append(host);
        mountDiagramViews(host, labels);

        const buttons = [ ...document.querySelectorAll<HTMLButtonElement>(".collab-view-mode") ];
        expect(buttons.map((button) => button.getAttribute("aria-label")))
            .toEqual([ "Source view", "Split view", "Preview" ]);
        // Left of the note options button, as the app lays out its title bar.
        expect(document.querySelector(".collab-view-modes + .collab-note-options")).not.toBeNull();
        expect(host.dataset.view).toBe("split");
        expect(buttons.map((button) => button.getAttribute("aria-pressed")))
            .toEqual([ "false", "true", "false" ]);

        buttons[2].click();
        expect(host.dataset.view).toBe("preview");
        expect(buttons.map((button) => button.getAttribute("aria-pressed")))
            .toEqual([ "false", "false", "true" ]);

        // The choice holds for the browser tab, across a reload of the page.
        document.querySelector(".collab-view-modes")?.remove();
        const reloaded = document.createElement("div");
        mountDiagramViews(reloaded, labels);
        expect(reloaded.dataset.view).toBe("preview");
    });
});

describe("mountMermaidEditor", () => {
    it("schedules no save for the note it loads, nor for a version from the server", () => {
        document.body.innerHTML = "<button class=\"collab-note-options\"></button>";
        const host = document.createElement("div");
        document.body.append(host);
        const saver = { scheduleContent: vi.fn(), preview: null };
        const strings = {
            placeholder: "", preview: "", views: { source: "", split: "", preview: "" }
        };

        const editor = mountMermaidEditor(
            host, "graph TD", saver as unknown as GuestSaver, strings);
        expect(saver.scheduleContent).not.toHaveBeenCalled();

        // A version loaded from the server is no edit either.
        editor.set("graph LR");
        expect(saver.scheduleContent).not.toHaveBeenCalled();
        expect(editor.get()).toBe("graph LR");
    });
});
