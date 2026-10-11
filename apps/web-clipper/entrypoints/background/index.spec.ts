import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

const { facade, TriliumError } = vi.hoisted(() => ({
    facade: {
        callService: vi.fn<(method: string, path: string, body?: unknown) => Promise<any>>(),
        triggerSearchForTrilium: vi.fn(),
        sendTriliumSearchStatusToPopup: vi.fn(),
        triggerSearchNoteByUrl: vi.fn()
    },
    TriliumError: class extends Error {

        constructor(readonly reason: string, message: string) {
            super(message);
        }

    }
}));

const backgroundStitcher = vi.hoisted(() => ({ created: vi.fn(), add: vi.fn(), finish: vi.fn() }));
vi.mock("@/screenshot", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/screenshot")>(),
    ScreenshotStitcher: class {

        add = backgroundStitcher.add;
        finish = backgroundStitcher.finish;

        constructor(request: unknown) {
            backgroundStitcher.created(request);
        }

    }
}));

vi.mock("./trilium_server_facade", () => ({
    TriliumError,
    default: class {

        callService = facade.callService;
        triggerSearchForTrilium = facade.triggerSearchForTrilium;
        sendTriliumSearchStatusToPopup = facade.sendTriliumSearchStatusToPopup;
        triggerSearchNoteByUrl = facade.triggerSearchNoteByUrl;

    }
}));

import background from "./index";

type Tab = { id?: number, title?: string, url?: string, favIconUrl?: string };
type ContextMenuClick = {
    menuItemId: string,
    pageUrl?: string,
    srcUrl?: string,
    linkUrl?: string,
    linkText?: string
};

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const CROPPED_PNG = "data:image/png;base64,Q1JPUA==";
const PNG_DATA_URL = /^data:image\/png;base64,/;
const PAGE_URL = "https://example.com/page";
const MENU_URL = "https://example.com/menu";
const ACTIVE_TAB: Tab = { id: 7, title: "Active page", url: PAGE_URL };
const TRILIUM_FAILURE = new TriliumError("not-found", "Trilium was not found.");
const FAILURE_TOAST = { name: "toast", message: "Trilium was not found.", noteId: null };
const GENERIC_FAILURE_TOAST = { name: "toast", message: expect.any(String), noteId: null };

let onCommand: (command: string) => Promise<void>;
let onContextMenuClicked: (info: ContextMenuClick) => Promise<void>;
let tabs: Tab[];
let tabMessageHandler: (message: { name: string }) => unknown;
const tabsSendMessage = vi.fn(
    (_tabId: number, message: { name: string }) => Promise.resolve(tabMessageHandler(message)));
/** How `readable-page.js` reads the active tab, by variant; nothing to save unless a test says so. */
let pageReadings: Record<string, unknown>;
const executeScript = vi.fn(async ({ args }: { args?: [ string ] }) => args ? [ { result: pageReadings[args[0]] } ] : []);
const contextMenusCreate = vi.fn();
const contextMenusRemoveAll = vi.fn(async () => {});
const getContexts = vi.fn(async (): Promise<unknown[]> => []);
const createDocument = vi.fn(async () => {});
const runtimeSendMessage = vi.fn(async (_message: unknown): Promise<unknown> => PNG);
/** Answers a picture for a web address, and decodes a `data:` URL as the browser does. */
const browserFetch = globalThis.fetch;
const fetchMockDefault = async (url: string) => (url.startsWith("data:")
    ? browserFetch(url)
    : new Response(new Blob([ "img" ], { type: "image/png" })));
const fetchMock = vi.fn(fetchMockDefault);
const SVG = "<svg xmlns='http://www.w3.org/2000/svg'></svg>";

describe("background", () => {
    beforeEach(async () => {
        fakeBrowser.reset();
        tabs = [ ACTIVE_TAB ];
        tabMessageHandler = () => undefined;
        pageReadings = {};
        facade.callService.mockResolvedValue({ noteId: "saved" });
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        Object.assign(fakeBrowser.commands.onCommand, {
            addListener: (listener: typeof onCommand) => {
                onCommand = listener;
            }
        });
        Object.assign(fakeBrowser.contextMenus, {
            create: contextMenusCreate,
            removeAll: contextMenusRemoveAll,
            onClicked: {
                addListener: (listener: typeof onContextMenuClicked) => {
                    onContextMenuClicked = listener;
                }
            }
        });
        Object.assign(fakeBrowser.tabs, {
            query: async ({ active }: { active?: boolean }) => (active ? tabs.slice(0, 1) : tabs),
            sendMessage: tabsSendMessage,
            getZoom: async () => 1.5,
            captureVisibleTab: async () => PNG
        });
        Object.assign(fakeBrowser.runtime, { getContexts, sendMessage: runtimeSendMessage });
        Object.assign(fakeBrowser, { offscreen: { createDocument }, scripting: { executeScript } });

        background.main();
        await vi.waitFor(() => expect(contextMenusCreate).toHaveBeenCalledTimes(7));
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("registers the context menu items once", () => {
        expect(contextMenusRemoveAll).toHaveBeenCalledBefore(contextMenusCreate);
        expect(contextMenusCreate.mock.calls.map(([ item ]) => item.id)).toEqual([
            "trilium-save-selection",
            "trilium-save-cropped-screenshot",
            "trilium-save-whole-screenshot",
            "trilium-save-full-page-screenshot",
            "trilium-save-page",
            "trilium-save-link",
            "trilium-save-image"
        ]);
    });

    describe("saving the selection", () => {
        it("inlines the images, saves a clipping and shows a toast", async () => {
            tabMessageHandler = () => ({
                title: "Page",
                content: `<img src="i2"><img src="i3"><img src="i4">`,
                images: [
                    { imageId: "i2", src: "https://example.com/a.png" },
                    { imageId: "i3", src: "data:image/jpeg;base64,/9j/4AAQ" },
                    { imageId: "i4", src: `data:image/svg+xml,${encodeURIComponent(SVG)}` }
                ]
            });

            await onContextMenuClicked({ menuItemId: "trilium-save-selection" });

            expect(tabsSendMessage).toHaveBeenCalledWith(7, { name: "trilium-save-selection" });
            expect(facade.callService).toHaveBeenCalledWith("POST", "clippings", {
                title: "Page",
                content: `<img src="i2"><img src="i3"><img src="i4">`,
                images: [
                    {
                        imageId: "i2",
                        src: "https://example.com/a.png",
                        dataUrl: expect.stringMatching(PNG_DATA_URL)
                    },
                    {
                        imageId: "i3",
                        src: "inline.jpeg",
                        dataUrl: "data:image/jpeg;base64,/9j/4AAQ"
                    },
                    {
                        imageId: "i4",
                        src: "inline.svg",
                        dataUrl: `data:image/svg+xml;base64,${btoa(SVG)}`
                    }
                ]
            });
            expect(await lastToast()).toMatchObject({
                name: "toast",
                message: "Selection has been saved to Trilium.",
                noteId: "saved",
                tabIds: null
            });
        });

        it("links the images it cannot download to their website and says so", async () => {
            fetchMock
                .mockRejectedValueOnce(new Error("blocked"))
                .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
                .mockResolvedValueOnce(new Response("<html>", { headers: { "Content-Type": "text/html" } }));
            tabMessageHandler = () => ({
                title: "Page",
                content: `<img src="i1"><img src="i2"><img src="i3"><img src="i4"><img src="i5">`,
                images: [
                    { imageId: "i1", src: "https://example.com/blocked$&$$.png" },
                    { imageId: "i2", src: "https://example.com/forbidden.png?a=1&b=\"2\"" },
                    { imageId: "i3", src: "https://example.com/page.html" },
                    { imageId: "i4", src: "https://example.com/ok.png" },
                    { imageId: "i5", src: "data:image/;base64,AAAA" }
                ]
            });

            await onContextMenuClicked({ menuItemId: "trilium-save-selection" });

            expect(lastPayload()).toEqual({
                title: "Page",
                content: `<img src="https://example.com/blocked$&amp;$$.png">`
                    + `<img src="https://example.com/forbidden.png?a=1&amp;b=&quot;2&quot;">`
                    + `<img src="https://example.com/page.html"><img src="i4">`
                    + `<img src="data:image/;base64,AAAA">`,
                images: [ {
                    imageId: "i4",
                    src: "https://example.com/ok.png",
                    dataUrl: expect.stringMatching(PNG_DATA_URL)
                } ]
            });
            expect(console.error).toHaveBeenCalledTimes(4);
            expect(await lastToast()).toMatchObject({
                message: "Selection has been saved to Trilium, but 4 images could not be downloaded.",
                noteId: "saved"
            });
        });

        it("counts an image the browser cannot read as not downloaded", async () => {
            vi.stubGlobal("FileReader", class {

                result = null;
                onloadend: (() => void) | null = null;

                readAsDataURL() {
                    setTimeout(() => this.onloadend?.());
                }

            });
            tabMessageHandler = () => ({
                title: "Page",
                content: `<img src="i1">`,
                images: [ { imageId: "i1", src: "https://example.com/a.png" } ]
            });

            await onContextMenuClicked({ menuItemId: "trilium-save-selection" });

            expect(lastPayload()).toMatchObject({ content: `<img src="https://example.com/a.png">`, images: [] });
            expect(await lastToast()).toMatchObject({
                message: "Selection has been saved to Trilium, but 1 image could not be downloaded."
            });
        });

        it("is bound to the keyboard shortcut and shows why saving failed", async () => {
            tabMessageHandler = () => ({ title: "Page", content: "x" });
            await onCommand("saveSelection");
            expect(await lastToast()).toMatchObject({ message: "Selection has been saved to Trilium." });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);

            await onCommand("saveSelection");

            expect(facade.callService)
                .toHaveBeenCalledWith("POST", "clippings", { title: "Page", content: "x" });
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });

        it("shows a toast when the page returns nothing or something else fails", async () => {
            await onCommand("saveSelection");
            expect(facade.callService).not.toHaveBeenCalled();
            expect(await lastToast()).toMatchObject(GENERIC_FAILURE_TOAST);

            tabMessageHandler = () => ({ title: "Page", content: "x" });
            facade.callService.mockRejectedValue(new Error("unexpected"));
            await onCommand("saveSelection");
            expect(await lastToast()).toMatchObject({
                ...GENERIC_FAILURE_TOAST,
                message: expect.stringContaining("unexpected")
            });
        });

        it("logs the failure when no page can show a toast", async () => {
            tabs = [];
            await expect(onCommand("saveSelection")).resolves.toBeUndefined();

            tabs = [ { title: "Tab without id" } ];
            await expect(onCommand("saveSelection")).resolves.toBeUndefined();

            tabs = [ ACTIVE_TAB ];
            tabMessageHandler = () => {
                throw new Error("Could not establish connection.");
            };
            await expect(onCommand("saveSelection")).resolves.toBeUndefined();
            await lastToast();
            expect(facade.callService).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledTimes(3);
        });
    });

    describe("saving the whole page", () => {
        it("saves the article from the shortcut, the menu and the popup", async () => {
            const page = { title: "Article", content: "<p>Body</p>", images: [], clipType: "page" };
            pageReadings = { article: page, wholePage: { ...page, content: "<nav>Menu</nav><p>Body</p>" } };

            await onCommand("saveWholePage");
            await onContextMenuClicked({ menuItemId: "trilium-save-page" });
            await sendRuntimeMessage({ name: "save-whole-page" });

            expect(executeScript).toHaveBeenCalledTimes(6);
            expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: [ "/readable-page.js" ] });
            expect(executeScript).not.toHaveBeenCalledWith(expect.objectContaining({ args: [ "wholePage" ] }));
            expect(facade.callService).toHaveBeenCalledTimes(3);
            expect(facade.callService).toHaveBeenLastCalledWith("POST", "notes", page);
            expect(await lastToast()).toMatchObject({ noteId: "saved" });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            tabsSendMessage.mockClear();
            await onCommand("saveWholePage");
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });

        it("saves the whole page from the shortcut when the page has no article", async () => {
            const wholePage = { title: "Gallery", content: "<h2>Card</h2>", images: [], clipType: "page" };
            pageReadings = { wholePage };

            await onCommand("saveWholePage");

            expect(facade.callService).toHaveBeenCalledWith("POST", "notes", wholePage);
            expect(await lastToast()).toMatchObject({ message: "Page has been saved to Trilium.", noteId: "saved" });
        });

        it("saves nothing from a page that shows nothing or is out of reach", async () => {
            await onCommand("saveWholePage");
            expect(await lastToast()).toMatchObject({
                ...GENERIC_FAILURE_TOAST,
                message: "Saving to Trilium failed: Trilium found nothing to save on this page."
            });

            pageReadings = { wholePage: { title: "Article", content: "<p>Body</p>", images: [] } };
            tabs = [ { title: "Tab without id" } ];
            await onCommand("saveWholePage");

            tabs = [ ACTIVE_TAB ];
            executeScript.mockRejectedValueOnce(new Error("Cannot access a chrome:// URL"));
            await onCommand("saveWholePage");
            expect(await lastToast()).toMatchObject({
                ...GENERIC_FAILURE_TOAST,
                message: "Saving to Trilium failed: Cannot access a chrome:// URL"
            });

            expect(executeScript).toHaveBeenCalledTimes(5);
            expect(facade.callService).not.toHaveBeenCalled();
        });

        it("saves the page the popup extracted, with the user's title, without reading it again", async () => {
            const page = {
                title: "Edited title",
                content: `<img src="i1">`,
                images: [ { imageId: "i1", src: "https://example.com/a.png" } ],
                pageUrl: PAGE_URL,
                clipType: "page",
                labels: {}
            };

            await sendRuntimeMessage({ name: "save-whole-page", page });

            expect(executeScript).not.toHaveBeenCalled();
            expect(facade.callService).toHaveBeenCalledWith("POST", "notes", {
                ...page,
                images: [ { ...page.images[0], dataUrl: expect.stringMatching(PNG_DATA_URL) } ]
            });
            expect(await lastToast()).toMatchObject({ message: "Page has been saved to Trilium.", noteId: "saved" });
        });

        it("saves the selection the popup read as a clipping, without reading it again", async () => {
            const selection = {
                title: "Edited title",
                content: `<p>Quote</p><img src="i1">`,
                images: [ { imageId: "i1", src: "https://example.com/a.png" } ],
                pageUrl: PAGE_URL
            };

            await sendRuntimeMessage({ name: "save-selection", selection });

            expect(tabsSendMessage).not.toHaveBeenCalledWith(7, { name: "trilium-save-selection" });
            expect(facade.callService).toHaveBeenCalledWith("POST", "clippings", {
                ...selection,
                images: [ { ...selection.images[0], dataUrl: expect.stringMatching(PNG_DATA_URL) } ]
            });
            expect(await lastToast()).toMatchObject({ message: "Selection has been saved to Trilium.", noteId: "saved" });
        });
    });

    describe("screenshots", () => {
        it("crops the screenshot in an offscreen document and saves it as an image", async () => {
            tabMessageHandler = () => ({
                rect: { x: 10, y: 20, width: 100, height: 50 },
                devicePixelRatio: 2
            });

            await onCommand("saveCroppedScreenshot");

            expect(createDocument).toHaveBeenCalledOnce();
            expect(runtimeSendMessage).toHaveBeenCalledWith({
                type: "CROP_IMAGE",
                dataUrl: PNG,
                cropRect: { x: 30, y: 60, width: 300, height: 150 }
            });
            const [ method, path, payload ] = facade.callService.mock.calls[0] ?? [];
            expect([ method, path ]).toEqual([ "POST", "clippings" ]);
            expect(payload).toEqual({
                title: "Active page",
                content: expect.stringMatching(/^<img src="[A-Za-z0-9]{20}">$/),
                images: [ { imageId: expect.any(String), src: "inline.png", dataUrl: PNG } ],
                pageUrl: PAGE_URL
            });
            const { content, images } = payload as {
                content: string,
                images: { imageId: string }[]
            };
            expect(content).toContain(images[0]?.imageId);
            expect(await lastToast()).toMatchObject({ noteId: "saved" });
        });

        it("reuses the offscreen document and uses the context menu's page URL", async () => {
            tabMessageHandler = () => ({ rect: { x: 0, y: 0, width: 10, height: 10 } });
            getContexts.mockResolvedValue([ { contextType: "OFFSCREEN_DOCUMENT" } ]);

            await onContextMenuClicked({
                menuItemId: "trilium-save-cropped-screenshot",
                pageUrl: MENU_URL
            });

            expect(createDocument).not.toHaveBeenCalled();
            expect(runtimeSendMessage).toHaveBeenCalledWith(expect.objectContaining({
                cropRect: { x: 0, y: 0, width: 15, height: 15 }
            }));
            expect(lastPayload()).toMatchObject({ pageUrl: MENU_URL });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            tabsSendMessage.mockClear();
            await sendRuntimeMessage({ name: "save-cropped-screenshot" });
            expect(lastPayload()).toMatchObject({ pageUrl: PAGE_URL });
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });

        it("saves nothing and shows nothing when the crop is cancelled", async () => {
            tabMessageHandler = (message) => {
                return message.name === "toast" ? undefined : { rect: null };
            };

            await expect(onCommand("saveCroppedScreenshot")).resolves.toBeUndefined();

            expect(facade.callService).not.toHaveBeenCalled();
            expect(await lastToast()).toBeUndefined();
        });

        it("saves the visible part of the page", async () => {
            await onContextMenuClicked({
                menuItemId: "trilium-save-whole-screenshot",
                pageUrl: MENU_URL
            });
            expect(lastPayload()).toMatchObject({
                images: [ { src: "inline.png", dataUrl: PNG } ],
                pageUrl: MENU_URL
            });
            expect(await lastToast()).toMatchObject({ noteId: "saved" });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            tabsSendMessage.mockClear();
            await sendRuntimeMessage({ name: "save-whole-screenshot" });
            expect(lastPayload()).toMatchObject({ pageUrl: PAGE_URL });
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });

        it("crops the screenshot on a canvas under Manifest V2", async () => {
            vi.stubGlobal("__MANIFEST_VERSION__", 2);
            const drawImage = vi.fn();
            const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
                .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
            vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(CROPPED_PNG);
            const image = stubImageLoading();
            tabMessageHandler = () => ({
                rect: { x: 10, y: 20, width: 100, height: 50 },
                devicePixelRatio: 1
            });

            await onCommand("saveCroppedScreenshot");

            expect(runtimeSendMessage).not.toHaveBeenCalled();
            expect(drawImage)
                .toHaveBeenCalledWith(image.instances[0], 15, 30, 150, 75, 0, 0, 150, 75);
            expect(lastPayload()).toMatchObject({
                images: [ { src: "inline.png", dataUrl: CROPPED_PNG } ]
            });

            getContext.mockReturnValue(null);
            tabsSendMessage.mockClear();
            await onCommand("saveCroppedScreenshot");
            expect(await lastToast()).toMatchObject(GENERIC_FAILURE_TOAST);

            image.fail = true;
            tabsSendMessage.mockClear();
            await onCommand("saveCroppedScreenshot");
            expect(await lastToast()).toMatchObject(GENERIC_FAILURE_TOAST);
        });
    });

    describe("full page screenshots", () => {
        const captureVisibleTab = vi.fn(async () => PNG);
        let tabActive: boolean;
        /** What the offscreen document was asked to stitch, and the images it answers with. */
        let offscreen: { request?: unknown, slices: { y: number }[], parts: string[] };

        beforeEach(() => {
            vi.useFakeTimers({ toFake: [ "setTimeout", "Date" ] });
            tabActive = true;
            offscreen = { slices: [], parts: [ CROPPED_PNG ] };
            Object.assign(fakeBrowser.tabs, {
                get: async () => ({ active: tabActive }),
                captureVisibleTab
            });
            runtimeSendMessage.mockImplementation(async (message) => {
                const { type, request, slice, index = 0 } = message as {
                    type?: string, request?: unknown, slice: { y: number }, index?: number
                };
                switch (type) {
                    case "STITCH_BEGIN": offscreen.request = request; return {};
                    case "STITCH_ADD": offscreen.slices.push(slice); return {};
                    case "STITCH_FINISH": return { count: offscreen.parts.length };
                    case "STITCH_PART": return { dataUrl: offscreen.parts[index] };
                    default: return PNG;
                }
            });
        });

        afterEach(() => {
            vi.useRealTimers();
            runtimeSendMessage.mockImplementation(async () => PNG);
        });

        /** Runs an action to its end, letting the waits between captures pass. */
        async function run(action: Promise<unknown>) {
            await vi.runAllTimersAsync();
            await action;
            vi.useRealTimers();
        }

        /**
         * What the page was asked to do, in order: the positions it was scrolled to (`undefined`
         * only asks where it is) and the steps of changing its floating elements.
         */
        function pageSteps() {
            return tabsSendMessage.mock.calls
                .map(([ , message ]) => message as { name: string, y?: number, step?: string })
                .filter((message) => [ "trilium-scroll-to", "trilium-set-floating-elements" ].includes(message.name))
                .map((message) => (message.name === "trilium-scroll-to" ? message.y : message.step));
        }

        const sliceTops = () => offscreen.slices.map((slice) => slice.y);

        it("captures the page a viewport at a time, stitching each capture offscreen", async () => {
            simulatePage({ startY: 300, viewportHeight: 500, pageHeight: 1200 });
            const captureTimes: number[] = [];
            captureVisibleTab.mockImplementation(async () => {
                captureTimes.push(Date.now());
                return PNG;
            });

            await run(onCommand("saveFullPageScreenshot"));

            expect(pageSteps()).toEqual([ undefined, 0, "first", 0, "rest", 500, 1000, "restore", 300 ]);
            expect(offscreen.request).toEqual({ pageHeight: 1200, devicePixelRatio: 1 });
            expect(offscreen.slices).toEqual([ { dataUrl: PNG, y: 0 }, { dataUrl: PNG, y: 500 }, { dataUrl: PNG, y: 700 } ]);
            const intervals = captureTimes.slice(1).map((time, index) => time - (captureTimes[index] ?? 0));
            expect(intervals.every((interval) => interval >= 550)).toBe(true);
            expect(lastPayload()).toMatchObject({
                content: expect.stringMatching(/^<img src="[A-Za-z0-9]{20}">$/),
                images: [ { src: "inline.png", dataUrl: CROPPED_PNG } ],
                pageUrl: PAGE_URL
            });
            expect(await lastToast()).toMatchObject({ message: "Screenshot has been saved to Trilium." });
        });

        it("saves a page stitched into several images as one image after another", async () => {
            simulatePage({ viewportHeight: 500, pageHeight: 500 });
            offscreen.parts = [ PNG, CROPPED_PNG ];

            await run(sendRuntimeMessage({ name: "save-full-page-screenshot" }));

            const { content, images } = lastPayload() as { content: string, images: { imageId: string, dataUrl: string }[] };
            expect(images.map((image) => image.dataUrl)).toEqual([ PNG, CROPPED_PNG ]);
            expect(content).toBe(images.map((image) => `<img src="${image.imageId}">`).join(""));
        });

        it("stops where the page stops scrolling, and says when a page is too long to capture in full", async () => {
            simulatePage({ viewportHeight: 500, pageHeight: 5000, scrollLimit: 1000 });
            await run(onContextMenuClicked({ menuItemId: "trilium-save-full-page-screenshot", pageUrl: MENU_URL }));
            expect(sliceTops()).toEqual([ 0, 500 ]);
            expect(lastPayload()).toMatchObject({ pageUrl: MENU_URL });
            expect(await lastToast()).toMatchObject({ message: "Screenshot has been saved to Trilium." });

            vi.useFakeTimers({ toFake: [ "setTimeout", "Date" ] });
            offscreen.slices = [];
            simulatePage({ viewportHeight: 2000, pageHeight: 100001, devicePixelRatio: 4 });
            await run(sendRuntimeMessage({ name: "save-full-page-screenshot" }));
            expect(offscreen.request).toEqual({ pageHeight: 100000, devicePixelRatio: 4 });
            expect(sliceTops()).toEqual(Array.from({ length: 50 }, (_, index) => index * 2000));
            expect(await lastToast()).toMatchObject({
                message: "Screenshot has been saved to Trilium, but the page was too long to capture in full."
            });
        });

        it("captures the page as it is laid out once its scrollbars are hidden", async () => {
            simulatePage({ viewportHeight: 500, pageHeight: 1200, prepared: { viewportHeight: 515, pageHeight: 1100 } });

            await run(onCommand("saveFullPageScreenshot"));

            expect(offscreen.request).toEqual({ pageHeight: 1100, devicePixelRatio: 1 });
            expect(sliceTops()).toEqual([ 0, 515, 585 ]);
        });

        it("stops and scrolls back when another tab is opened, even if scrolling back fails", async () => {
            simulatePage({ startY: 300, viewportHeight: 500, pageHeight: 1200 });
            const scrollPage = tabMessageHandler;
            tabMessageHandler = (message) => {
                const { y, step } = message as { y?: number, step?: string };
                if (y === 300 || step === "restore") throw new Error("The tab is gone.");
                return scrollPage(message);
            };
            tabActive = false;

            await run(sendRuntimeMessage({ name: "save-full-page-screenshot" }));

            expect(captureVisibleTab).not.toHaveBeenCalled();
            expect(pageSteps()).toEqual([ undefined, 0, "first", 0, "restore", 300 ]);
            expect(await lastToast()).toMatchObject({
                message: "Saving to Trilium failed: The screenshot was stopped because another tab was opened."
            });
        });

        it("reports a page that does not answer, a failed stitch, and a tab without an ID", async () => {
            await run(sendRuntimeMessage({ name: "save-full-page-screenshot" }));
            expect(await lastToast()).toMatchObject({
                message: "Saving to Trilium failed: The page could not be read. Reload it and try again."
            });

            vi.useFakeTimers({ toFake: [ "setTimeout", "Date" ] });
            simulatePage({ viewportHeight: 500, pageHeight: 500 });
            runtimeSendMessage.mockImplementation(async () => ({ error: "Too tall" }));
            await run(sendRuntimeMessage({ name: "save-full-page-screenshot" }));
            expect(await lastToast()).toMatchObject({ message: "Saving to Trilium failed: Too tall" });

            tabs = [ { title: "Tab without id" } ];
            await sendRuntimeMessage({ name: "save-full-page-screenshot" });
            expect(facade.callService).not.toHaveBeenCalled();
        });

        it("stitches in the background page under Manifest V2", async () => {
            vi.stubGlobal("__MANIFEST_VERSION__", 2);
            backgroundStitcher.finish.mockReturnValue([ CROPPED_PNG ]);
            simulatePage({ viewportHeight: 500, pageHeight: 500 });

            await run(sendRuntimeMessage({ name: "save-full-page-screenshot" }));

            expect(runtimeSendMessage).not.toHaveBeenCalled();
            expect(backgroundStitcher.created).toHaveBeenCalledWith({ pageHeight: 500, devicePixelRatio: 1 });
            expect(backgroundStitcher.add).toHaveBeenCalledWith({ dataUrl: PNG, y: 0 });
            expect(lastPayload()).toMatchObject({ images: [ { dataUrl: CROPPED_PNG } ] });
        });
    });

    describe("context menu", () => {
        it("saves an image by fetching it", async () => {
            await onContextMenuClicked({ menuItemId: "trilium-save-image", pageUrl: PAGE_URL });
            expect(facade.callService).not.toHaveBeenCalled();

            await onContextMenuClicked({
                menuItemId: "trilium-save-image",
                srcUrl: "https://example.com/cat.png",
                pageUrl: PAGE_URL
            });
            expect(fetchMock).toHaveBeenCalledWith("https://example.com/cat.png");
            expect(lastPayload()).toMatchObject({
                title: "Active page",
                images: [ {
                    src: "https://example.com/cat.png",
                    dataUrl: expect.stringMatching(PNG_DATA_URL)
                } ],
                pageUrl: PAGE_URL
            });
            expect(await lastToast()).toMatchObject({ noteId: "saved" });

            fetchMock.mockResolvedValueOnce(new Response("Not found", { status: 404 }));
            await onContextMenuClicked({
                menuItemId: "trilium-save-image",
                srcUrl: "https://example.com/gone.png",
                pageUrl: PAGE_URL
            });
            expect(lastPayload()).toMatchObject({
                content: `<img src="https://example.com/gone.png">`,
                images: []
            });
            expect(await lastToast()).toMatchObject({
                message: "Image has been saved to Trilium, but 1 image could not be downloaded.",
                noteId: "saved"
            });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            tabsSendMessage.mockClear();
            await onContextMenuClicked({
                menuItemId: "trilium-save-image",
                srcUrl: "https://example.com/cat.png"
            });
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });

        it("labels screenshots and images with the page's description", async () => {
            tabMessageHandler = (message) => message.name === "trilium-get-page-metadata"
                ? { description: "About the page" }
                : undefined;
            await sendRuntimeMessage({ name: "save-whole-screenshot" });
            expect(lastPayload()).toMatchObject({ labels: { pageDescription: "About the page" } });
            await onContextMenuClicked({
                menuItemId: "trilium-save-image",
                srcUrl: "https://example.com/cat.png",
                pageUrl: PAGE_URL
            });
            expect(lastPayload()).toMatchObject({ labels: { pageDescription: "About the page" } });

            tabMessageHandler = () => ({});
            await sendRuntimeMessage({ name: "save-whole-screenshot" });
            expect(lastPayload()).not.toHaveProperty("labels");

            // An outdated content script answers nothing; none runs on browser pages.
            tabMessageHandler = () => undefined;
            await sendRuntimeMessage({ name: "save-whole-screenshot" });
            expect(lastPayload()).not.toHaveProperty("labels");

            tabMessageHandler = () => {
                throw new Error("Could not establish connection.");
            };
            facade.callService.mockClear();
            await sendRuntimeMessage({ name: "save-whole-screenshot" });
            expect(lastPayload()).not.toHaveProperty("labels");
            expect(facade.callService).toHaveBeenCalledOnce();
        });

        it("saves a link, with its URL as the text when the browser gives none", async () => {
            await onContextMenuClicked({ menuItemId: "trilium-save-link", pageUrl: PAGE_URL });
            expect(facade.callService).not.toHaveBeenCalled();

            await onContextMenuClicked({
                menuItemId: "trilium-save-link",
                linkUrl: "https://example.com/target",
                linkText: "Target",
                pageUrl: PAGE_URL
            });
            expect(facade.callService).toHaveBeenLastCalledWith("POST", "clippings", {
                title: "Active page",
                content: "<a href=\"https://example.com/target\">Target</a>",
                pageUrl: PAGE_URL
            });
            expect(await lastToast()).toMatchObject({ noteId: "saved" });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            tabsSendMessage.mockClear();
            await onContextMenuClicked({
                menuItemId: "trilium-save-link",
                linkUrl: "https://example.com/target"
            });
            expect(lastPayload()).toMatchObject({
                content: "<a href=\"https://example.com/target\">https://example.com/target</a>"
            });
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });

        it("ignores unknown items and commands", async () => {
            await onContextMenuClicked({ menuItemId: "unknown" });
            await onCommand("unknown");
            expect(facade.callService).not.toHaveBeenCalled();
            expect(tabsSendMessage).not.toHaveBeenCalled();
        });
    });

    describe("saving tabs", () => {
        it("saves the tabs as a list of links, titled by the most common domains", async () => {
            tabs = [
                { id: 1, title: "A1", url: "https://a.com/1" },
                { id: 2, title: "B1", url: "https://b.com/1" },
                { title: "B2", url: "https://b.com/2" },
                { id: 4, title: "C1", url: "https://c.com/1" },
                { id: 5, title: "D1", url: "https://d.com/1" }
            ];

            await onCommand("saveTabs");

            expect(facade.callService).toHaveBeenCalledWith("POST", "notes", {
                title: "5 browser tabs: b.com, a.com, c.com...",
                content: "<ul>"
                    + "<li><a href=\"https://a.com/1\">A1</a></li>"
                    + "<li><a href=\"https://b.com/1\">B1</a></li>"
                    + "<li><a href=\"https://b.com/2\">B2</a></li>"
                    + "<li><a href=\"https://c.com/1\">C1</a></li>"
                    + "<li><a href=\"https://d.com/1\">D1</a></li>"
                    + "</ul>",
                clipType: "tabs",
                tabs: [ "a.com/1", "b.com/1", "b.com/2", "c.com/1", "d.com/1" ].map((path) => ({
                    url: `https://${path}`,
                    title: path.replace(/^(\w)\.com\//, (_, letter: string) => letter.toUpperCase()),
                    favicon: undefined
                }))
            });
            expect(await lastToast()).toMatchObject({ noteId: "saved", tabIds: [ 1, 2, 4, 5 ] });
        });

        it("skips tabs without a URL and escapes the titles", async () => {
            tabs = [
                { id: 1, title: "Loading" },
                { id: 2, title: "<b>Bold</b> & \"quoted\"", url: "https://a.com/?x=1&y=\"2\"" },
                { id: 3, url: "https://a.com/untitled" }
            ];

            await onCommand("saveTabs");

            expect(lastPayload()).toEqual({
                title: "2 browser tabs: a.com",
                content: "<ul><li><a href=\"https://a.com/?x=1&amp;y=&quot;2&quot;\">"
                    + "&lt;b&gt;Bold&lt;/b&gt; &amp; &quot;quoted&quot;</a></li>"
                    + "<li><a href=\"https://a.com/untitled\">https://a.com/untitled</a></li></ul>",
                clipType: "tabs",
                tabs: [
                    { url: "https://a.com/?x=1&y=\"2\"", title: "<b>Bold</b> & \"quoted\"" },
                    { url: "https://a.com/untitled", title: "https://a.com/untitled" }
                ]
            });
            expect(await lastToast()).toMatchObject({
                message: "2 links have been saved to Trilium.",
                tabIds: [ 2, 3 ]
            });
        });

        it("sends each favicon it can read as a data URL", async () => {
            tabs = [
                { id: 1, title: "Missing", url: "https://a.com/", favIconUrl: "https://a.com/missing.ico" },
                { id: 2, title: "Fetched", url: "https://b.com/", favIconUrl: "https://b.com/favicon.png" },
                { id: 3, title: "Inline", url: "https://c.com/", favIconUrl: "data:image/svg+xml,<svg/>" },
                { id: 4, title: "Browser page", url: "chrome://newtab/", favIconUrl: "chrome://theme/icon" }
            ];
            // The favicons are fetched in tab order; the second and third get the default answer.
            fetchMock.mockImplementationOnce(async () => new Response("Not found", { status: 404 }));
            fetchMock.mockImplementationOnce(fetchMockDefault);
            fetchMock.mockImplementationOnce(fetchMockDefault);
            fetchMock.mockImplementationOnce(async () => {
                throw new TypeError("Failed to fetch");
            });

            await onCommand("saveTabs");

            expect((lastPayload() as { tabs: unknown }).tabs).toEqual([
                { url: "https://a.com/", title: "Missing", favicon: undefined },
                { url: "https://b.com/", title: "Fetched", favicon: "data:image/png;base64,aW1n" },
                { url: "https://c.com/", title: "Inline", favicon: "data:image/svg+xml;base64,PHN2Zy8+" },
                { url: "chrome://newtab/", title: "Browser page", favicon: undefined }
            ]);
        });

        it("adds no ellipsis for up to three tabs and shows why saving failed", async () => {
            tabs = [
                { id: 1, title: "A", url: "https://a.com/" },
                { id: 2, title: "B", url: "https://b.com/" }
            ];
            facade.callService.mockRejectedValue(TRILIUM_FAILURE);

            await sendRuntimeMessage({ name: "save-tabs" });

            expect(lastPayload()).toMatchObject({ title: "2 browser tabs: a.com, b.com" });
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);
        });
    });

    describe("popup and toast messages", () => {
        it("saves a link with a note, titled after the tab when the title is blank", async () => {
            const saveWithTitle = (title: string, content = "") => sendRuntimeMessage({
                name: "save-link-with-note",
                title,
                content
            });

            await expect(saveWithTitle("  ", "Note")).resolves.toBe(true);
            expect(facade.callService).toHaveBeenLastCalledWith("POST", "notes", {
                title: "Active page",
                content: "Note",
                clipType: "note",
                pageUrl: PAGE_URL
            });
            expect(await lastToast()).toMatchObject({ noteId: "saved" });

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            await expect(saveWithTitle("Mine")).resolves.toBeUndefined();
            expect(lastPayload()).toMatchObject({ title: "Mine" });

            tabs = [ { id: 7, url: "https://example.com/untitled" } ];
            await saveWithTitle("");
            expect(lastPayload()).toMatchObject({ title: "" });
        });

        it("labels a bookmark with the description the popup sends", async () => {
            const save = (description?: string) => sendRuntimeMessage(
                { name: "save-link-with-note", title: "T", content: "", description });

            await save("About the page");
            expect(lastPayload()).toMatchObject({ labels: { pageDescription: "About the page" } });

            await save();
            expect(lastPayload()).not.toHaveProperty("labels");
        });

        it("opens a note in the browser when the desktop app cannot", async () => {
            const create = vi.fn(async (_properties: { url: string }) => ({}));
            Object.assign(fakeBrowser.tabs, { create });
            const openNote = () => sendRuntimeMessage({ name: "openNoteInTrilium", noteId: "n1" });

            facade.callService.mockResolvedValue({ result: "ok" });
            await openNote();
            expect(facade.callService).toHaveBeenLastCalledWith("POST", "open/n1");

            facade.callService.mockRejectedValue(TRILIUM_FAILURE);
            await openNote();
            expect(await lastToast()).toMatchObject(FAILURE_TOAST);

            facade.callService.mockResolvedValue({ result: "open-in-browser" });
            vi.mocked(console.error).mockClear();
            await openNote();
            expect(console.error).toHaveBeenCalledOnce();
            expect(create).not.toHaveBeenCalled();

            await fakeBrowser.storage.sync.set({ triliumServerUrl: "https://trilium.example" });
            await openNote();
            expect(create).toHaveBeenCalledExactlyOnceWith({ url: "https://trilium.example/#n1" });
        });

        it("closes the saved tabs", async () => {
            const remove = vi.spyOn(fakeBrowser.tabs, "remove").mockResolvedValue(undefined);
            await sendRuntimeMessage({ name: "closeTabs", tabIds: [ 1, 2 ] });
            expect(remove).toHaveBeenCalledWith([ 1, 2 ]);
        });

        it("forwards Trilium searches to the server facade", async () => {
            await sendRuntimeMessage({ name: "trigger-trilium-search" });
            expect(facade.triggerSearchForTrilium).toHaveBeenCalledOnce();

            await sendRuntimeMessage({ name: "send-trilium-search-status" });
            expect(facade.sendTriliumSearchStatusToPopup).toHaveBeenCalledOnce();

            await sendRuntimeMessage({ name: "trigger-trilium-search-note-url" });
            expect(facade.triggerSearchNoteByUrl).toHaveBeenCalledWith(PAGE_URL);

            tabs = [ { id: 7 } ];
            await sendRuntimeMessage({ name: "trigger-trilium-search-note-url" });
            expect(facade.triggerSearchNoteByUrl).toHaveBeenCalledOnce();

            await expect(sendRuntimeMessage({ name: "unknown" })).resolves.toBeUndefined();
        });
    });
});

async function sendRuntimeMessage(message: object) {
    const [ result ] = await fakeBrowser.runtime.onMessage.trigger(message, {}, () => {});
    return result;
}

function lastPayload() {
    return facade.callService.mock.lastCall?.[2];
}

async function lastToast() {
    await new Promise((resolve) => setTimeout(resolve));
    return tabsSendMessage.mock.calls
        .map(([ , message ]) => message)
        .filter((message) => message.name === "toast")
        .at(-1);
}

/**
 * Answers the content script's scroll messages for a page of `pageHeight` that scrolls no further
 * than `scrollLimit`, starting at `startY`.
 */
/**
 * Answers the content script's messages for a page of `pageHeight` that scrolls no further than
 * `scrollLimit`, starting at `startY`. `prepared` is the size it has once its scrollbars are
 * hidden.
 */
function simulatePage({ startY = 0, viewportHeight, pageHeight, scrollLimit = pageHeight, devicePixelRatio = 1, prepared }: {
    startY?: number, viewportHeight: number, pageHeight: number, scrollLimit?: number, devicePixelRatio?: number,
    prepared?: { viewportHeight: number, pageHeight: number }
}) {
    let scrollY = startY;
    let size = { viewportHeight, pageHeight, scrollLimit };
    tabMessageHandler = (message) => {
        const { y, step } = message as { y?: number, step?: string };
        if (step === "first" && prepared) {
            size = { ...prepared, scrollLimit: prepared.pageHeight };
        }
        if (message.name !== "trilium-scroll-to") return undefined;
        if (y !== undefined) {
            scrollY = Math.max(0, Math.min(y, size.scrollLimit - size.viewportHeight));
        }
        return { scrollX: 0, scrollY, viewportHeight: size.viewportHeight, pageHeight: size.pageHeight, devicePixelRatio };
    };
}

function stubImageLoading() {
    const state = { fail: false, instances: [] as object[] };
    vi.stubGlobal("Image", class {

        onload: (() => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        constructor() {
            state.instances.push(this);
        }

        set src(_value: string) {
            setTimeout(() => (state.fail ? this.onerror?.(new Event("error")) : this.onload?.()));
        }

    });
    return state;
}
