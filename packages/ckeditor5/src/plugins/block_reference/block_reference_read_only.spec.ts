import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { applyTabs } from "../tabs/tabs_read_only.js";
import { getBlockRangeElements, showBlockReference } from "./block_reference_read_only.js";

let scrollIntoView: MockInstance<Element["scrollIntoView"]>;

beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("showBlockReference", () => {
    it("opens the collapsed blocks around a block, centers it and flashes it for a moment", () => {
        const container = buildContainer(
            "<details><summary>s1</summary><details><summary>s2</summary>"
            + "<p data-trilium-block-id=\"a\">A</p></details></details>"
        );
        const block = container.querySelector("p");

        expect(showBlockReference(container, "a")).toBe(true);

        expect([ ...container.querySelectorAll("details") ].map((details) => details.open))
            .toEqual([ true, true ]);
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
            behavior: "smooth", block: "center"
        });
        expect(scrollIntoView.mock.contexts[0]).toBe(block);
        expect(getFlashed(container)).toEqual([ "A" ]);

        vi.advanceTimersByTime(1500);
        expect(getFlashed(container)).toEqual([]);
    });

    it("shows the tab that holds a block, and scrolls to the title of a linked tab", () => {
        const container = buildContainer(
            "<div class=\"trilium-tabs\">"
            + "<section class=\"trilium-tab\"><p class=\"trilium-tab-title\">A</p>"
            + "<div class=\"trilium-tab-panel\"></div></section>"
            + "<section class=\"trilium-tab\" data-trilium-block-id=\"t\">"
            + "<p class=\"trilium-tab-title\">B</p><div class=\"trilium-tab-panel\">"
            + "<p data-trilium-block-id=\"a\">a</p></div></section>"
            + "<section class=\"trilium-tab\" data-trilium-block-id=\"bare\"><p>c</p></section>"
            + "</div>"
        );
        applyTabs(container, { placeholder: "" });
        const activeTitle = () =>
            container.querySelector(".trilium-tab--active > .trilium-tab-title");
        const titleB = container.querySelectorAll(".trilium-tab-title")[1];
        expect(activeTitle()?.textContent).toBe("A");

        showBlockReference(container, "a");
        expect(activeTitle()?.textContent).toBe("B");

        showBlockReference(container, "t");
        expect(scrollIntoView.mock.contexts[1]).toBe(titleB);

        showBlockReference(container, "bare");
        expect(scrollIntoView.mock.contexts[2])
            .toBe(container.querySelector("[data-trilium-block-id=bare]"));
    });

    it("flashes the outermost elements of a range, in document order", () => {
        const container = buildContainer(
            "<p>before</p><p data-trilium-block-id=\"a\">A</p><blockquote><p>quote</p></blockquote>"
            + "<ul><li><p data-trilium-block-id=\"b\">B</p><p>rest of item</p></li>"
            + "<li>after</li></ul>"
        );

        expect(showBlockReference(container, "b:a")).toBe(true);

        expect(getFlashed(container)).toEqual([ "A", "quote", "B" ]);
    });

    it("shows the block found of a broken range, and nothing for a missing block", () => {
        const container = buildContainer("<p data-trilium-block-id=\"b\">B</p><p>other</p>");

        expect(showBlockReference(container, "gone")).toBe(false);
        expect(showBlockReference(container, "a:b:c")).toBe(false);
        expect(scrollIntoView).not.toHaveBeenCalled();

        expect(showBlockReference(container, "gone:b")).toBe(false);
        expect(scrollIntoView.mock.contexts[0]).toBe(container.querySelector("p"));
        expect(getFlashed(container)).toEqual([ "B" ]);
    });
});

describe("getBlockRangeElements", () => {
    it("returns a single block, or the blocks between two in a list", () => {
        const container = buildContainer(
            "<ol><li data-trilium-block-id=\"a\">A</li><li>B</li>"
            + "<li data-trilium-block-id=\"c\">C</li><li>D</li></ol>"
        );
        const [ first, , third ] = container.querySelectorAll("li");

        expect(getBlockRangeElements(first, first)).toEqual([ first ]);
        expect(getBlockRangeElements(first, third).map((element) => element.textContent))
            .toEqual([ "A", "B", "C" ]);
    });
});

function buildContainer(html: string) {
    const container = document.createElement("div");
    container.innerHTML = html;
    return container;
}

function getFlashed(container: HTMLElement) {
    return [ ...container.querySelectorAll(".block-reference-flash") ]
        .map((element) => element.textContent);
}
