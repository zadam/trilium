import type { Window as HappyDOMWindow } from "happy-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { ReadablePage } from "@/utils";

import readablePage from "./index";

const PARAGRAPH = "Trilium is a hierarchical note taking application with focus on "
    + "building large personal knowledge bases. It supports rich text, code, canvas and many "
    + "other note types, scripting and sync. ";

describe("readable page", () => {
    beforeEach(() => {
        (window as unknown as HappyDOMWindow).happyDOM.setURL("https://example.com/blog/post.html?id=1#comments");
        document.head.innerHTML = "<title>Post title</title>";
        document.body.innerHTML = "";
    });

    it("returns the article with absolute links, image placeholders and its dates as labels", () => {
        document.head.innerHTML = `
            <title>Article title</title>
            <meta property="article:published_time" content="2026-01-02T10:00:00Z">
            <meta property="article:modified_time" content="2026-02-03T10:00:00Z">
            <meta property="og:description" content="About the article">
            <script>window.tracked = true;</script>`;
        document.body.innerHTML = `
            <nav><a href="/">Home</a> <a href="/archive">Archive</a></nav>
            <article>
                <h1>Article title</h1>
                <p>${PARAGRAPH.repeat(3)}<a href="/docs">Docs</a>
                    <a href="mailto:jane@example.com">Jane</a></p>
                <p>${PARAGRAPH.repeat(3)}</p>
                <img src="figure.png" width="600" height="400">
                <img src="figure.png" width="600" height="400">
                <p onclick="alert(1)">${PARAGRAPH.repeat(3)}</p>
            </article>`;
        const pageBefore = document.documentElement.outerHTML;

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
                imageId: expect.stringMatching(/^[A-Za-z0-9]{20}$/),
                src: "https://example.com/blog/figure.png"
            } ]
        });
        expect(page?.content.match(/<img [^>]*>/g)).toEqual([
            expect.stringContaining(`src="${page?.images[0]?.imageId}"`),
            expect.stringContaining(`src="${page?.images[0]?.imageId}"`)
        ]);
        expect(page?.content).toContain("href=\"https://example.com/docs\"");
        expect(page?.content).toContain("href=\"mailto:jane@example.com\"");
        expect(page?.content).not.toContain("Archive");
        expect(page?.content).not.toContain("onclick");
        expect(document.documentElement.outerHTML).toBe(pageBefore);
    });

    it("dates the article from its structured data, and leaves out a date it cannot read", () => {
        const article = `<article><p>${PARAGRAPH.repeat(5)}</p></article>`;
        const structuredData = (datePublished: string) => `<script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org", "@type": "NewsArticle", headline: "Post title", datePublished
        })}</script>`;

        document.head.innerHTML = `<title>Post title</title>${structuredData("2025-12-24T08:00:00Z")}
            <meta property="article:published_time" content="">`;
        document.body.innerHTML = article;
        expect(readPage()?.labels).toEqual({ publishedDate: "2025-12-24" });

        document.head.innerHTML = `<title>Post title</title>${structuredData("next week")}
            <meta property="article:modified_time" content="not a date">`;
        document.body.innerHTML = article;
        expect(readPage()?.labels).toEqual({});
    });

    it("keeps the day the page states, whatever its offset from UTC", () => {
        document.head.innerHTML = `
            <title>Post title</title>
            <meta property="article:published_time" content="2022-02-09T00:30:00+01:00">
            <meta property="article:modified_time" content="2022-02-10T23:30:00-05:00">`;
        document.body.innerHTML = `<article><p>${PARAGRAPH.repeat(5)}</p></article>`;
        expect(readPage()?.labels).toEqual({ publishedDate: "2022-02-09", modifiedDate: "2022-02-10" });

        document.head.innerHTML = "<title>Post title</title>";
        document.body.innerHTML = `<article><p>${PARAGRAPH.repeat(5)}</p>
            <p>Published <time>February 8, 2022</time></p></article>`;
        expect(readPage()?.labels).toEqual({});
    });

    it("keeps an article that is only a picture, and returns nothing for a page without one", () => {
        document.body.innerHTML = `<article><img src="photo.jpg" width="800" height="600"></article>`;
        expect(readPage()?.images.map(({ src }) => src)).toEqual([ "https://example.com/blog/photo.jpg" ]);

        document.body.innerHTML = "<nav><a href=\"/\">Home</a> <a href=\"/archive\">Archive</a></nav>";
        expect(readPage()).toBeUndefined();
    });
});

function readPage() {
    return readablePage.main() as ReadablePage | undefined;
}
