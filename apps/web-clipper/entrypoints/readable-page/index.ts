import Defuddle from "defuddle";

import { descriptionLabels, getImages, getPageLocationOrigin, type ReadablePage } from "@/utils";

/**
 * Extracts the readable page with Defuddle. `extractReadablePage()` injects it into the tab only
 * when a page is read, so Defuddle does not load with the content script on every page. The value
 * `main()` returns is the result of `executeScript()`.
 */
export default defineUnlistedScript(readPage);

function readPage(): ReadablePage | undefined {
    // `parse()` works on a copy of the document and reads styles and image sizes from the page,
    // so it is given the live document.
    const article = new Defuddle(document, { url: location.href }).parse();

    // A document of its own loads none of the article's images and runs none of its code.
    const body = new DOMParser().parseFromString(article.content, "text/html").body;
    if (!body.textContent.trim() && !body.querySelector("img")) {
        return undefined;
    }

    const images = getImages(body);

    const labels = descriptionLabels();
    const publishedDate = isoDate(metaContent("article:published_time") || article.published);
    if (publishedDate) {
        labels['publishedDate'] = publishedDate;
    }
    const modifiedDate = isoDate(metaContent("article:modified_time"));
    if (modifiedDate) {
        labels['modifiedDate'] = modifiedDate;
    }

    return {
        title: article.title,
        content: body.innerHTML,
        images,
        pageUrl: getPageLocationOrigin() + location.pathname + location.search,
        clipType: 'page',
        labels
    };
}

function metaContent(property: string) {
    return document.querySelector(`meta[property='${property}']`)?.getAttribute("content") ?? undefined;
}

/** The day of `value` as `YYYY-MM-DD`, or `undefined` when it is missing or not a date. */
function isoDate(value: string | undefined) {
    const date = new Date(value ?? "");
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().substring(0, 10);
}
