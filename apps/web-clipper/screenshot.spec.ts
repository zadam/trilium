import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_SCREENSHOT_HEIGHT, stitchScreenshots } from "./screenshot";

const STITCHED = "data:image/png;base64,U1RJVENI";

describe("stitchScreenshots", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("draws each capture where it was taken, scaled to device pixels", async () => {
        const images = stubImages({ naturalWidth: 1600, naturalHeight: 1000 });
        const { canvas, drawImage } = stubCanvas();

        const result = await stitchScreenshots({
            slices: [ { dataUrl: "first", y: 0 }, { dataUrl: "second", y: 500 }, { dataUrl: "last", y: 700 } ],
            viewportHeight: 500,
            pageHeight: 1200
        });

        expect(result).toBe(STITCHED);
        expect(images.map((image) => image.src)).toEqual([ "first", "second", "last" ]);
        expect([ canvas().width, canvas().height ]).toEqual([ 1600, 2400 ]);
        expect(drawImage.mock.calls).toEqual([
            [ images[0], 0, 0 ],
            [ images[1], 0, 1000 ],
            [ images[2], 0, 1400 ]
        ]);
    });

    it("keeps the canvas within the height a browser can draw", async () => {
        stubImages({ naturalWidth: 800, naturalHeight: 4000 });
        const { canvas } = stubCanvas();

        await stitchScreenshots({ slices: [ { dataUrl: "a", y: 0 } ], viewportHeight: 1000, pageHeight: 10000 });

        expect(canvas().height).toBe(MAX_SCREENSHOT_HEIGHT);
    });

    it("fails without captures, without a canvas, or on a capture that cannot be read", async () => {
        const request = { slices: [ { dataUrl: "a", y: 0 } ], viewportHeight: 100, pageHeight: 100 };
        stubImages({ naturalWidth: 100, naturalHeight: 100 });

        await expect(stitchScreenshots({ ...request, slices: [] }))
            .rejects.toThrow("There is no screenshot to stitch.");

        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        await expect(stitchScreenshots(request)).rejects.toThrow("The screenshot could not be drawn.");

        stubImages({ naturalWidth: 100, naturalHeight: 100, fail: true });
        await expect(stitchScreenshots(request)).rejects.toThrow("A part of the screenshot could not be read.");
    });
});

/** Replaces `Image` with one that loads at the given size, or fails to load. */
function stubImages({ naturalWidth, naturalHeight, fail = false }: {
    naturalWidth: number, naturalHeight: number, fail?: boolean
}) {
    const images: { src?: string }[] = [];
    vi.stubGlobal("Image", class {

        naturalWidth = naturalWidth;
        naturalHeight = naturalHeight;
        onload?: () => void;
        onerror?: () => void;

        constructor() {
            images.push(this);
        }

        set src(value: string) {
            Object.defineProperty(this, "src", { value });
            setTimeout(() => (fail ? this.onerror?.() : this.onload?.()));
        }

    });
    return images;
}

function stubCanvas() {
    const drawImage = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(STITCHED);
    return { drawImage, canvas: () => getContext.mock.contexts[0] as HTMLCanvasElement };
}
