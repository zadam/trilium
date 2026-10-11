/** One capture of the visible part of a page, taken with the page scrolled to `y` CSS pixels. */
export interface ScreenshotSlice {
    dataUrl: string;
    y: number;
}

export interface StitchRequest {
    /** The height of the page to stitch, in CSS pixels. */
    pageHeight: number;
    /** The page's `devicePixelRatio`: the device pixels of a capture per CSS pixel, zoom included. */
    devicePixelRatio: number;
}

/** How the background script has the offscreen document stitch a screenshot, one step a message. */
export type StitchMessage =
    | { type: "STITCH_BEGIN", request: StitchRequest }
    | { type: "STITCH_ADD", slice: ScreenshotSlice }
    | { type: "STITCH_FINISH" }
    | { type: "STITCH_PART", index: number };

/**
 * The tallest image of a screenshot, in device pixels; a longer page is saved as several images.
 * Small enough for one image, as a PNG data URL, to fit in one extension message (64 MiB in Chrome).
 */
export const MAX_PART_HEIGHT = 8192;

/**
 * Draws the captures of a scrolled page, given in order from the top, into images of at most
 * {@link MAX_PART_HEIGHT}. Each image is encoded as soon as the next one begins, so only one is
 * held as pixels.
 */
export class ScreenshotStitcher {

    private width = 0;
    private readonly height: number;
    private part: { index: number, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D } | undefined;
    private readonly parts: string[] = [];

    constructor(private readonly request: StitchRequest) {
        this.height = Math.round(request.pageHeight * request.devicePixelRatio);
    }

    async add({ dataUrl, y }: ScreenshotSlice) {
        const image = await loadImage(dataUrl);
        this.width ||= image.naturalWidth;

        const top = Math.round(y * this.request.devicePixelRatio);
        const bottom = Math.min(top + image.naturalHeight, this.height);
        for (let index = Math.floor(top / MAX_PART_HEIGHT); index * MAX_PART_HEIGHT < bottom; index++) {
            // The last capture overlaps the one before it, which already drew any part it reaches back into.
            if (this.part && index < this.part.index) continue;
            this.openPart(index).drawImage(image, 0, top - index * MAX_PART_HEIGHT);
        }
    }

    /** Returns the images as PNG data URLs, from the top of the page. */
    finish() {
        if (!this.part) {
            throw new Error("There is no screenshot to stitch.");
        }
        this.closePart(this.part);
        return this.parts;
    }

    private openPart(index: number) {
        if (this.part?.index === index) return this.part.context;
        if (this.part) this.closePart(this.part);

        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = Math.min(MAX_PART_HEIGHT, this.height - index * MAX_PART_HEIGHT);
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("The screenshot could not be drawn.");
        }
        this.part = { index, canvas, context };
        return context;
    }

    private closePart(part: { canvas: HTMLCanvasElement }) {
        this.parts.push(part.canvas.toDataURL("image/png"));
        this.part = undefined;
    }

}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("A part of the screenshot could not be read."));
        image.src = src;
    });
}
