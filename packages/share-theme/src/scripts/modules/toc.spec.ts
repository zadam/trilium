// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import setupToC from "./toc.js";

describe("setupToC", () => {
    function render(content: string) {
        document.body.innerHTML = `<div id="right-pane">
            <div id="content">${content}</div>
            <ul id="toc"><li><a href="#a">A</a></li><li><a href="#b">B</a></li></ul>
        </div>`;
        const pane = document.getElementById("right-pane");
        const link = document.querySelector("#toc a");
        if (!pane || !link) throw new Error("fixture");
        return { pane, link };
    }

    it("runs again for new content without stacking the previous run's scroll listener", () => {
        const { pane, link } = render(`<h2 id="a">A</h2><h2 id="b">B</h2>`);
        setupToC();
        setupToC();

        const update = vi.spyOn(link.classList, "remove");
        pane.dispatchEvent(new Event("scroll"));
        expect(update).toHaveBeenCalledTimes(1);
    });

    it("leaves a contents list alone when the content has no headings", () => {
        render(`<p>No headings</p>`);
        expect(() => setupToC()).not.toThrow();
    });
});
