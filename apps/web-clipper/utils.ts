export type Rect = { x: number, y: number, width: number, height: number };

/** An image of a clipping; the clipping's `content` references it by `imageId`. */
export type ClippedImage = { imageId: string, src: string };

/** The readable version of a page, as `entrypoints/readability/index.ts` extracts it. */
export interface ReadablePage {
    title: string;
    content: string;
    images: ClippedImage[];
    pageUrl: string;
    clipType: "page";
    labels: Record<string, string>;
}

/**
 * Runs `entrypoints/readability/index.ts` in the tab and returns the page it read, or `undefined`
 * when the page has no article. Throws where the extension cannot run scripts, such as browser
 * pages.
 */
export async function extractReadablePage(tabId: number): Promise<ReadablePage | undefined> {
    const [ injection ] = await browser.scripting.executeScript({
        target: { tabId },
        files: [ "/readability.js" ]
    });
    return (injection?.result ?? undefined) as ReadablePage | undefined;
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

/** Replaces the `src` of each image in `container` with an `imageId`, the same one for the same image. */
export function getImages(container: HTMLElement) {
    const images: ClippedImage[] = [];

    for (const img of container.getElementsByTagName('img')) {
        if (!img.src) {
            continue;
        }

        const existingImage = images.find(image => image.src === img.src);

        if (existingImage) {
            img.src = existingImage.imageId;
        }
        else {
            const imageId = randomString(20);

            images.push({
                imageId,
                src: img.src
            });

            img.src = imageId;
        }
    }

    return images;
}
