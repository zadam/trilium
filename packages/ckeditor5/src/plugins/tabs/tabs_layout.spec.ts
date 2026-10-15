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

/** The height of the text of `element`, which grows with each line it wraps onto. */
function textHeightOf(element: Element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().height;
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

    it("clips a long title at 30% of the block and scrolls it back after editing", async () => {
        const long = tab("A title far too long for a third of the block", "<p>Body</p>");
        const html = `<div class="trilium-tabs">${long}${tab("B", "")}</div>`;
        const container = document.createElement("div");
        container.className = "ck-content";
        container.style.width = "600px";
        container.innerHTML = html;
        document.body.appendChild(container);
        onTestFinished(() => container.remove());
        applyTabs(container, { placeholder: "Tab title" });

        const editor = await createTestEditor([Essentials, Paragraph, Tabs]);
        const editable = editor.ui.view.editable.element as HTMLElement;
        editable.style.width = "600px";
        editor.setData(html);

        const blocks = [container, editable].map(root => root.querySelector(".trilium-tabs"));
        for (const block of blocks) {
            const [long, short] = [...block?.querySelectorAll(".trilium-tab-title") ?? []];
            expect(long).toBeDefined();
            expect(short).toBeDefined();
            const width = block?.getBoundingClientRect().width ?? NaN;
            expect(long.getBoundingClientRect().width / width).toBeCloseTo(0.3, 2);
            expect(long.scrollWidth).toBeGreaterThan(long.clientWidth);
            expect(textHeightOf(long)).toBe(textHeightOf(short));
        }

        const title = editable.querySelector(".trilium-tab-title") as HTMLElement;
        editor.editing.view.document.isFocused = true;
        editor.model.change(writer => {
            const root = editor.model.document.getRoot();
            if (root) {
                writer.setSelection(writer.createPositionFromPath(root, [0, 0, 0, 0]));
            }
        });
        title.scrollLeft = 40;
        expect(title.scrollLeft).toBe(40);

        editor.model.change(writer => {
            const root = editor.model.document.getRoot();
            if (root) {
                writer.setSelection(writer.createPositionFromPath(root, [0, 0, 1, 0, 0]));
            }
        });
        expect(title.scrollLeft).toBe(0);
    });

    it("outlines the innermost block holding the caret and rings only a title", async () => {
        const editor = await createTestEditor([Essentials, Paragraph, Tabs]);
        const editable = editor.ui.view.editable.element as HTMLElement;
        editor.editing.view.document.isFocused = true;
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--ck-color-focus-border", "rgb(12, 34, 56)");
        rootStyle.setProperty("--link-color", "rgb(65, 43, 21)");
        onTestFinished(() => {
            rootStyle.removeProperty("--ck-color-focus-border");
            rootStyle.removeProperty("--link-color");
        });
        const inner = `<div class="trilium-tabs">${tab("B1", "<p>b1</p>")}${tab("B2", "")}</div>`;
        editor.setData(
            `<p>Before</p><div class="trilium-tabs">${tab("A", inner)}${tab("C", "")}</div>`
        );
        const blocks = [...editable.querySelectorAll<HTMLElement>(".trilium-tabs.ck-widget")];
        const outlines = () => blocks.map(block => getComputedStyle(block).outlineColor);
        const ring = (element: Element | null) => {
            expect(element).not.toBeNull();
            const style = getComputedStyle(element as Element);
            return [style.borderTopColor, style.boxShadow, style.transitionDuration];
        };
        const select = (path: number[]) => editor.model.change(writer => {
            const root = editor.model.document.getRoot();
            if (root) {
                writer.setSelection(writer.createPositionFromPath(root, path));
            }
        });
        expect(blocks).toHaveLength(2);
        expect(outlines()).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);

        select([1, 0, 1, 0, 0, 1, 0, 0]);
        const innerPanel = blocks[1].querySelector(".trilium-tab-panel");
        expect(ring(innerPanel)).toEqual(["rgba(0, 0, 0, 0)", "none", "0s"]);
        await expect.poll(outlines).toEqual(["rgba(0, 0, 0, 0)", "rgb(65, 43, 21)"]);

        select([1, 0, 0, 0]);
        const outerTitle = blocks[0].querySelector(".trilium-tab-title");
        expect(ring(outerTitle).filter((_, index) => index !== 1))
            .toEqual(["rgb(12, 34, 56)", "0s"]);
        await expect.poll(outlines).toEqual(["rgb(65, 43, 21)", "rgba(0, 0, 0, 0)"]);
    });
});
