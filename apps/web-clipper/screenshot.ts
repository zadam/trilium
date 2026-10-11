/** One capture of the visible part of a page, taken with the page scrolled to `y` CSS pixels. */
export interface ScreenshotSlice {
    dataUrl: string;
    y: number;
}

export interface StitchRequest {
    slices: ScreenshotSlice[];
    /** The height of the page's viewport, in CSS pixels. */
    viewportHeight: number;
    /** The height of the whole page, in CSS pixels. */
    pageHeight: number;
}

/**
 * The tallest image the stitched screenshot can be, in device pixels. Browsers refuse to draw a
 * canvas much taller than this, and Chrome's limit is the lowest.
 */
export const MAX_SCREENSHOT_HEIGHT = 16384;

/**
 * Draws the captures of a scrolled page onto one canvas, each at the position it was taken at, and
 * returns the result as a PNG data URL. The last capture overlaps the one before it when the page
 * height is not a multiple of the viewport height, and is drawn over it.
 */
export async function stitchScreenshots({ slices, viewportHeight, pageHeight }: StitchRequest) {
    const loaded = await Promise.all(slices.map(async (slice) => ({
        image: await loadImage(slice.dataUrl),
        y: slice.y
    })));
    const first = loaded[0]?.image;
    if (!first) {
        throw new Error("There is no screenshot to stitch.");
    }

    // The captures are in device pixels, which include the page zoom and the display's scaling.
    const scale = first.naturalHeight / viewportHeight;

    const canvas = document.createElement("canvas");
    canvas.width = first.naturalWidth;
    canvas.height = Math.min(Math.round(pageHeight * scale), MAX_SCREENSHOT_HEIGHT);

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("The screenshot could not be drawn.");
    }

    for (const { image, y } of loaded) {
        context.drawImage(image, 0, Math.round(y * scale));
    }

    return canvas.toDataURL("image/png");
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("A part of the screenshot could not be read."));
        image.src = src;
    });
}
