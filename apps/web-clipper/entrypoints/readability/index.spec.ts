import { Readability } from "@mozilla/readability";
import type { Window as HappyDOMWindow } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadablePage } from "@/utils";

import readability from "./index";

const PARAGRAPH = "Trilium is a hierarchical note taking application with focus on "
    + "building large personal knowledge bases. It supports rich text, code, canvas and many "
    + "other note types, scripting and sync. ";

describe("readable page", () => {
    beforeEach(() => {
        (window as unknown as HappyDOMWindow).happyDOM.setURL("https://example.com/blog/post.html?id=1#comments");
        document.head.innerHTML = "<title> Post title </title>";
        document.body.innerHTML = "";
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the readable article with its publication dates as labels", () => {
        document.head.innerHTML = `
            <title>Article title</title>
            <meta property="article:published_time" content="2026-01-02T10:00:00Z">
            <meta property="article:modified_time" content="2026-02-03T10:00:00Z">
            <meta property="og:description" content="About the article">`;
        document.body.innerHTML = `
            <nav><a href="/">Home</a></nav>
            <article>
                <h1>Article title</h1>
                <p>${PARAGRAPH.repeat(3)}<a href="/docs">Docs</a>
                    <a href="mailto:jane@example.com">Jane</a></p>
                <p>${PARAGRAPH.repeat(3)}</p>
                <img src="figure.png">
                <p>${PARAGRAPH.repeat(3)}</p>
            </article>`;

        const page = readPage();

        expect(page).toMatchObject({
            title: "Article title",
            pageUrl: "https://example.com/blog/post.html?id=1",
            clipType: "page",
            labels: {
                pageDescription: "About the article",
                publishedDate: "2026-01-02",
                modifiedDate: "2026-02-03"
            },
            images: [ {
                imageId: expect.any(String),
                src: "https://example.com/blog/figure.png"
            } ]
        });
        expect(page?.content).toContain(`src="${page?.images[0]?.imageId}"`);
        expect(page?.content).toContain("href=\"https://example.com/docs\"");
        expect(page?.content).toContain("href=\"mailto:jane@example.com\"");
        expect(page?.content).not.toContain("Home");
        expect(document.querySelector("nav")).not.toBeNull();
    });

    it("adds no labels without dates, and titles an untitled article after the document", () => {
        document.body.innerHTML = `<article><p>${PARAGRAPH.repeat(5)}</p></article>`;
        expect(readPage()?.labels).toEqual({});

        const content = document.createElement("div");
        vi.spyOn(Readability.prototype, "parse")
            .mockReturnValue({ title: null, content } as unknown as ReturnType<Readability["parse"]>);
        expect(readPage()?.title).toBe("Post title");
    });

    it("returns nothing when Readability finds no article", () => {
        vi.spyOn(Document.prototype, "cloneNode")
            .mockReturnValue(document.implementation.createHTMLDocument(""));
        expect(readPage()).toBeUndefined();
    });
});

function readPage() {
    return readability.main() as ReadablePage | undefined;
}
