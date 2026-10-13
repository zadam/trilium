import { Essentials, Paragraph } from "ckeditor5";
import editorStylesheetUrl from "ckeditor5/ckeditor5.css?url";
import { beforeAll, describe, expect, it, onTestFinished } from "vitest";

import { createTestEditor } from "../../../test/editor-kit.js";
import type { TabAlignment } from "./constants.js";
import Tabs from "./tabs.js";
import { applyTabs } from "./tabs_read_only.js";

function tab(title: string, body: string) {
    return `<section class="trilium-tab"><p class="trilium-tab-title">${title}</p>` +
        `<div class="trilium-tab-panel">${body}</div></section>`;
}

/** Three tabs, the last with a title of two lines, so the titles differ in height. */
function tabsHtml(alignment: TabAlignment | null) {
    const attribute = alignment ? ` data-trilium-tab-alignment="${alignment}"` : "";
    return `<div class="trilium-tabs"${attribute}>` +
        tab("Windows", "<p>Run the installer.</p>") +
        tab("Linux", "<p>Use the package.</p>") +
        tab("Two<br>lines", "<p>Wrap it.</p>") +
    "</div>";
}

/** The radii of the top-left, top-right, bottom-right and bottom-left corners. */
function cornersOf(element: Element | null | undefined) {
    if (!element) {
        return null;
    }
    const style = getComputedStyle(element);
    return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius
    ].join(" ");
}

/** The top of the text of `element`, which its padding offsets from its box. */
function textTopOf(element: Element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().top;
}

/** Where the titles of a tabs block sit around the panel of its first tab, and their corners. */
function measure(block: Element | null, alignment: TabAlignment) {
    expect(block).not.toBeNull();
    const titles = [...block?.querySelectorAll(":scope > .trilium-tab > .trilium-tab-title") ?? []];
    const panel = block?.querySelector(".trilium-tab--active > .trilium-tab-panel");
    const panelRect = panel?.getBoundingClientRect();
    expect(titles).toHaveLength(3);
    expect(panelRect).toBeDefined();

    const gaps = titles.map(title => {
        const rect = title.getBoundingClientRect();
        const gap = alignment === "top"
            ? (panelRect?.top ?? NaN) - rect.bottom
            : rect.top - (panelRect?.bottom ?? NaN);
        return Math.round(gap);
    });
    return {
        gaps,
        inset: Math.round(titles[0].getBoundingClientRect().left - (panelRect?.left ?? NaN)),
        textOffset: Math.round(textTopOf(titles[1]) - textTopOf(titles[0])),
        corners: [panel, ...titles.slice(0, 2)].map(cornersOf)
    };
}

const EXPECTED = {
    top: {
        gaps: [0, 2, 2],
        inset: 0,
        textOffset: 0,
        corners: ["0px 8px 8px 8px", "8px 8px 0px 0px", "8px 8px 0px 0px"]
    },
    bottom: {
        gaps: [0, 2, 2],
        inset: 0,
        textOffset: 0,
        corners: ["8px 8px 8px 0px", "0px 0px 8px 8px", "0px 0px 8px 8px"]
    }
};

describe("tabs layout styles", () => {
    beforeAll(() => new Promise<void>((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = editorStylesheetUrl;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error("the editor stylesheet did not load"));
        document.head.appendChild(link);
    }));

    it("puts the titles above or below the panel in saved content", () => {
        for (const [attribute, alignment] of [[null, "top"], ["bottom", "bottom"]] as const) {
            const container = document.createElement("div");
            container.className = "ck-content";
            container.style.width = "600px";
            container.innerHTML = tabsHtml(attribute);
            document.body.appendChild(container);
            onTestFinished(() => container.remove());
            applyTabs(container, { placeholder: "Tab title" });

            const block = container.querySelector(".trilium-tabs");
            expect(measure(block, alignment), alignment).toEqual(EXPECTED[alignment]);
        }
    });

    it("puts the titles above or below the panel in the editor", async () => {
        const editor = await createTestEditor([Essentials, Paragraph, Tabs]);
        const editable = editor.ui.view.editable.element as HTMLElement;
        editable.style.width = "600px";

        for (const alignment of ["top", "bottom"] as const) {
            editor.setData(tabsHtml(alignment));
            const block = editable.querySelector(".trilium-tabs.ck-widget");
            expect(measure(block, alignment), alignment).toEqual(EXPECTED[alignment]);
        }
    });
});
