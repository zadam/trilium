import Defuddle from "defuddle";

import { descriptionLabels, type ExtractedPage, getImages, getPageLocationOrigin, type ReadablePage } from "@/utils";

/**
 * Reads the page with Defuddle, as an article and as a whole. `extractPage()` injects it into the
 * tab only when a page is read, so Defuddle does not load with the content script on every page. The
 * value `main()` returns is the result of `executeScript()`.
 */
export default defineUnlistedScript(readPage);

/**
 * Keeps all of `<body>`: Defuddle still removes hidden elements, makes links absolute and converts
 * embeds, but none of what it scores as clutter, which on a page without an article is the content.
 */
const WHOLE_PAGE_OPTIONS = {
    contentSelector: "body",
    removeLowScoring: false,
    removeExactSelectors: false,
    removePartialSelectors: false,
    removeContentPatterns: false,
    removeSmallImages: false
};

function readPage(): ExtractedPage | undefined {
    // `parse()` works on a copy of the document and reads styles and image sizes from the page,
    // so it is given the live document.
    const article = new Defuddle(document, { url: location.href }).parse();
    const wholePage = new Defuddle(document, { url: location.href, ...WHOLE_PAGE_OPTIONS }).parse();

    const page = {
        title: article.title,
        pageUrl: getPageLocationOrigin() + location.pathname + location.search,
        clipType: "page" as const,
        labels: pageLabels(article)
    };
    const whole = withContent(page, wholePage.content);
    if (!whole) {
        return undefined;
    }
    return { article: withContent(page, article.content), wholePage: whole };
}

/** The clip of `html`, its images replaced by placeholders, or `undefined` when it shows nothing. */
function withContent(page: Omit<ReadablePage, "content" | "images">, html: string): ReadablePage | undefined {
    // A document of its own loads none of the page's images and runs none of its code.
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (!body.textContent.trim() && !body.querySelector("img")) {
        return undefined;
    }

    const images = getImages(body);
    return { ...page, content: body.innerHTML, images };
}

function pageLabels(article: { author: string, published: string }) {
    const labels = descriptionLabels();
    const author = article.author.replace(/\s+/g, " ").trim();
    if (author) {
        labels['pageAuthor'] = author;
    }
    const publishedDate = isoDate(metaContent("article:published_time") || article.published);
    if (publishedDate) {
        labels['publishedDate'] = publishedDate;
    }
    const modifiedDate = isoDate(metaContent("article:modified_time"));
    if (modifiedDate) {
        labels['modifiedDate'] = modifiedDate;
    }
    return labels;
}

function metaContent(property: string) {
    return document.querySelector(`meta[property='${property}']`)?.getAttribute("content") ?? undefined;
}

/**
 * The `YYYY-MM-DD` that `value` starts with, or `undefined` when it does not start with one. The day
 * is the one the page states: converting a timestamp to UTC can move it to the day before or after.
 */
function isoDate(value: string | undefined) {
    return /^\d{4}-\d{2}-\d{2}/.exec(value?.trim() ?? "")?.[0];
}
