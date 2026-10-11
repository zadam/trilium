import { Readability } from "@mozilla/readability";

import {
    descriptionLabels, getImages, getPageLocationOrigin, makeLinksAbsolute, type ReadablePage
} from "@/utils";

/**
 * Extracts the readable page. `extractReadablePage()` injects it into the tab only when a page is
 * read, so Readability does not load with the content script on every page. The value `main()`
 * returns is the result of `executeScript()`.
 */
export default defineUnlistedScript(readPage);

function readPage(): ReadablePage | undefined {
    // Readability changes the document it parses, so it reads a copy of the page.
    const documentCopy = document.cloneNode(true) as Document;
    const article = new Readability(documentCopy, {
        // Returns the content as an element rather than as HTML.
        serializer: (node) => node as HTMLElement
    }).parse();

    if (!article?.content) {
        return undefined;
    }

    const body = article.content;
    makeLinksAbsolute(body);
    const images = getImages(body);

    const labels = descriptionLabels();
    const { publishedDate, modifiedDate } = getDocumentDates();
    if (publishedDate) {
        labels['publishedDate'] = publishedDate.toISOString().substring(0, 10);
    }
    if (modifiedDate) {
        labels['modifiedDate'] = modifiedDate.toISOString().substring(0, 10);
    }

    return {
        title: article.title ?? document.title,
        content: body.innerHTML,
        images,
        pageUrl: getPageLocationOrigin() + location.pathname + location.search,
        clipType: 'page',
        labels
    };
}

function getDocumentDates() {
    let publishedDate: Date | null = null;
    let modifiedDate: Date | null = null;

    const articlePublishedTime = document.querySelector("meta[property='article:published_time']")?.getAttribute('content');
    if (articlePublishedTime) {
        publishedDate = new Date(articlePublishedTime);
    }

    const articleModifiedTime = document.querySelector("meta[property='article:modified_time']")?.getAttribute('content');
    if (articleModifiedTime) {
        modifiedDate = new Date(articleModifiedTime);
    }

    // TODO: if we didn't get dates from meta, then try to get them from JSON-LD
    return { publishedDate, modifiedDate };
}
