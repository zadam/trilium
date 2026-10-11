export type Rect = { x: number, y: number, width: number, height: number };

/** An image of a clipping; the clipping's `content` references it by `imageId`. */
export type ClippedImage = { imageId: string, src: string };

/** A page clip, as `entrypoints/readable-page/index.ts` extracts it. */
export interface ReadablePage {
    title: string;
    content: string;
    images: ClippedImage[];
    pageUrl: string;
    clipType: "page";
    labels: Record<string, string>;
}

/** The two ways to clip a page: its article, when Defuddle finds one, and all of it. */
export interface ExtractedPage {
    article?: ReadablePage;
    wholePage: ReadablePage;
}

/**
 * Runs `entrypoints/readable-page/index.ts` in the tab and returns the page it read, or `undefined`
 * when the page shows nothing. Throws where the extension cannot run scripts, such as browser pages.
 */
export async function extractPage(tabId: number): Promise<ExtractedPage | undefined> {
    const [ injection ] = await browser.scripting.executeScript({
        target: { tabId },
        files: [ "/readable-page.js" ]
    });
    return (injection?.result ?? undefined) as ExtractedPage | undefined;
}

export function randomString(len: number) {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < len; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

export function getPageLocationOrigin() {
    // location.origin normally returns the protocol + domain + port (eg. https://example.com:8080)
    // but for file:// protocol this is browser dependant and in particular Firefox returns "null" in this case.
    return location.protocol === 'file:' ? 'file://' : location.origin;
}

export function createLink(clickAction: object, text: string, color = "lightskyblue") {
    const link = document.createElement('a');
    link.href = "javascript:";
    link.style.color = color;
    link.appendChild(document.createTextNode(text));
    link.addEventListener("click", () => {
        browser.runtime.sendMessage(null, clickAction);
    });

    return link;
}

/** The page's own summary, preferred to the one it gives social sites, on a single line. */
export function getPageDescription() {
    const selectors = [
        "meta[name='description']",
        "meta[property='og:description']",
        "meta[name='twitter:description']"
    ];
    for (const selector of selectors) {
        const description = document.querySelector(selector)?.getAttribute("content")
            ?.replace(/\s+/g, " ").trim();
        if (description) return description;
    }
    return undefined;
}

/** The `#pageDescription` label of every clip of the page, if the page has one. */
export function descriptionLabels(): Record<string, string> {
    const description = getPageDescription();
    return description ? { pageDescription: description } : {};
}

export function makeLinksAbsolute(container: HTMLElement) {
    // `link.href` reads the URL the browser resolved against the page, and leaves
    // `mailto:`, `tel:` and other non-web schemes unchanged.
    for (const link of container.getElementsByTagName('a')) {
        if (link.href) {
            link.setAttribute("href", link.href);
        }
    }
}

/**
 * Replaces the `src` of each image in `container` with an `imageId`, the same one for the same image.
 * An image waiting to be lazy-loaded is listed under the address the page keeps for later.
 */
export function getImages(container: HTMLElement) {
    const images: ClippedImage[] = [];

    for (const img of container.getElementsByTagName('img')) {
        const src = lazyImageSource(img) ?? img.src;
        if (!src) {
            continue;
        }

        const existingImage = images.find(image => image.src === src);

        if (existingImage) {
            img.src = existingImage.imageId;
        }
        else {
            const imageId = randomString(20);

            images.push({
                imageId,
                src
            });

            img.src = imageId;
        }
    }

    return images;
}

/** The attributes lazy-loading scripts keep an image's address in, the same ones Defuddle reads. */
const LAZY_SOURCE_ATTRIBUTES = [ "data-src", "data-original", "data-lazy-src" ];

/** The web address in the first lazy-loading attribute of `img` that holds one. */
function lazyImageSource(img: HTMLImageElement) {
    for (const attribute of LAZY_SOURCE_ATTRIBUTES) {
        const value = img.getAttribute(attribute)?.trim();
        if (!value) continue;

        let url: URL;
        try {
            url = new URL(value, img.baseURI);
        } catch {
            continue;
        }
        if (url.protocol === "http:" || url.protocol === "https:") {
            return url.href;
        }
    }
    return undefined;
}
