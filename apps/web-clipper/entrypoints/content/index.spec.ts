import type { Window as HappyDOMWindow } from "happy-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

vi.mock("@/lib/toast", () => ({}));

import contentScript from "./index";

type Rect = { x: number, y: number, width: number, height: number };
type Clipping = {
    title: string,
    content: string,
    images: { imageId: string, src: string }[],
    pageUrl: string,
    labels: Record<string, string>
};

describe("content script", () => {
    beforeAll(() => {
        contentScript.main(undefined as never);
    });

    beforeEach(() => {
        setUrl("https://example.com/blog/post.html?id=1#comments");
        document.head.innerHTML = "<title> Post title </title>";
        document.body.innerHTML = "";
        vi.spyOn(console, "info").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("saving the selection", () => {
        it("returns the selected HTML with absolute links and deduplicated images", async () => {
            document.body.innerHTML = `
                <p id="start">Before <a href="other.html">relative</a> and <a>no href</a></p>
                <img src="/cat.png">
                <img src="https://cdn.example.com/dog.png">
                <img src="/cat.png">
                <img>
                <p id="end">After</p>`;
            document.head.insertAdjacentHTML(
                "beforeend", "<meta name=\"description\" content=\"About the post\">");
            selectRange("start", "end");

            const response = await send<Clipping>({ name: "trilium-save-selection" });

            expect(response.title).toBe("Post title");
            expect(response.labels).toEqual({ pageDescription: "About the post" });
            expect(response.pageUrl).toBe("https://example.com/blog/post.html?id=1#comments");
            expect(response.images.map((image) => image.src)).toEqual([
                "https://example.com/cat.png",
                "https://cdn.example.com/dog.png"
            ]);
            const container = document.createElement("div");
            container.innerHTML = response.content;
            expect(attributes(container, "a", "href"))
                .toEqual([ "https://example.com/blog/other.html", null ]);
            expect(attributes(container, "img", "src")).toEqual([
                response.images[0]?.imageId,
                response.images[1]?.imageId,
                response.images[0]?.imageId,
                null
            ]);
        });

        it("keeps links to schemes other than the web as they are", async () => {
            const links = [
                "mailto:jane@example.com",
                "tel:+40123",
                "ftp://ftp.example.com/file",
                "magnet:?xt=urn:btih:abc"
            ];
            document.body.innerHTML = `<p id="p">${
                links.map((href) => `<a href="${href}">link</a>`).join(" ")
            }</p>`;
            selectRange("p", "p");

            const response = await send<Clipping>({ name: "trilium-save-selection" });

            const container = document.createElement("div");
            container.innerHTML = response.content;
            expect(attributes(container, "a", "href")).toEqual(links);
        });

        it("falls back to the document title and fails without a selection", async () => {
            document.head.innerHTML = "";
            document.body.innerHTML = "<p id=\"p\">Text</p>";
            selectRange("p", "p");
            expect(document.getElementsByTagName("title")).toHaveLength(0);
            const untitled = await send<Clipping>({ name: "trilium-save-selection" });
            expect(untitled.title).toBe("");
            expect(untitled.labels).toEqual({});

            document.title = " Fallback ";
            expect(await send({ name: "trilium-save-selection" }))
                .toMatchObject({ title: "Fallback" });

            window.getSelection()?.removeAllRanges();
            expect(await send({ name: "trilium-save-selection" })).toBeUndefined();
            expect(console.error).toHaveBeenCalledOnce();
        });
    });

    describe("page metadata", () => {
        it("reads the description from the first description tag that has one", async () => {
            const getMetadata = () => send({ name: "trilium-get-page-metadata" });
            document.head.innerHTML = `
                <meta name="twitter:description" content="From Twitter">
                <meta property="og:description" content="From Open Graph">
                <meta name="description" content="  Spread
                    over lines  ">`;
            expect(await getMetadata()).toEqual({ description: "Spread over lines" });

            document.querySelector("meta[name='description']")?.remove();
            expect(await getMetadata()).toEqual({ description: "From Open Graph" });

            document.querySelector("meta[property='og:description']")?.setAttribute("content", " ");
            expect(await getMetadata()).toEqual({ description: "From Twitter" });

            document.head.innerHTML = "<meta name=\"description\">";
            expect(await getMetadata()).toEqual({});
        });
    });

    describe("screenshot area", () => {
        it("returns the dragged rectangle once the overlay is gone", async () => {
            vi.useFakeTimers();
            const response = send<{ rect: Rect | null, devicePixelRatio: number }>({
                name: "trilium-get-rectangle-for-screenshot"
            });
            const [ overlay, messageComp, selection ] =
                [ ...document.body.children ] as HTMLElement[];
            expect(document.activeElement).toBe(messageComp);

            mouse(overlay, "mousemove", 5, 5);
            mouse(overlay, "mousedown", 200, 150);
            mouse(overlay, "mousemove", 100, 100);
            const { left, top, width, height } = selection?.style ?? {};
            expect([ left, top, width, height ]).toEqual([ "100px", "100px", "100px", "50px" ]);
            mouse(overlay, "mouseup", 50, 50);
            expect(document.body.children).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(100);
            await expect(response).resolves.toEqual({
                rect: { x: 50, y: 50, width: 150, height: 100 },
                devicePixelRatio: window.devicePixelRatio
            });
        });

        it("keeps the rectangle between the start and the cursor when the drag reverses", async () => {
            vi.useFakeTimers();
            const response = send({ name: "trilium-get-rectangle-for-screenshot" });
            const [ overlay, , selection ] = [ ...document.body.children ] as HTMLElement[];

            mouse(overlay, "mousedown", 200, 150);
            mouse(overlay, "mousemove", 100, 100);
            mouse(overlay, "mousemove", 300, 250);
            const { left, top, width, height } = selection?.style ?? {};
            expect([ left, top, width, height ]).toEqual([ "200px", "150px", "100px", "100px" ]);
            mouse(overlay, "mouseup", 300, 250);

            await vi.advanceTimersByTimeAsync(100);
            await expect(response).resolves.toMatchObject({
                rect: { x: 200, y: 150, width: 100, height: 100 }
            });
        });

        it("returns no rectangle without a drag on the overlay or after Escape", async () => {
            const release = send({ name: "trilium-get-rectangle-for-screenshot" });
            mouse(document.body.firstElementChild, "mouseup", 10, 10);
            await expect(release).resolves.toMatchObject({ rect: null });

            const cancelled = send({ name: "trilium-get-rectangle-for-screenshot" });
            const messageComp = document.body.children[1];
            messageComp?.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
            expect(document.body.children).toHaveLength(3);
            messageComp?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            expect(document.body.children).toHaveLength(0);
            await expect(cancelled).resolves.toMatchObject({ rect: null });
        });
    });

    describe("toast", () => {
        it("shows a plain message, or links to the saved note and the saved tabs", async () => {
            const showToast = vi.fn();
            window.showToast = showToast;
            const sendMessage = vi.spyOn(fakeBrowser.runtime, "sendMessage")
                .mockResolvedValue(undefined);

            await send({ name: "toast", message: "Saved." });
            expect(showToast)
                .toHaveBeenLastCalledWith("Saved.", { settings: { duration: 7000 } });

            await send({ name: "toast", message: "Saved.", noteId: "n1" });
            const noteMessage = showToast.mock.lastCall?.[0] as HTMLElement;
            expect(noteMessage.querySelectorAll("a")).toHaveLength(1);

            await send({ name: "toast", message: "Saved.", noteId: "n1", tabIds: [ 1, 2 ] });
            const tabsMessage = showToast.mock.lastCall?.[0] as HTMLElement;
            const [ openLink, closeLink ] = tabsMessage.querySelectorAll("a");
            openLink?.click();
            closeLink?.click();
            expect(sendMessage.mock.calls).toEqual([
                [ null, { name: "openNoteInTrilium", noteId: "n1" } ],
                [ null, { name: "closeTabs", tabIds: [ 1, 2 ] } ]
            ]);
        });
    });

    it("answers unknown messages with nothing", async () => {
        expect(await send({ name: "unknown" })).toBeUndefined();
        expect(console.error).toHaveBeenCalledOnce();
    });
});

function send<T = unknown>(message: object) {
    return new Promise<T>((resolve) => {
        void fakeBrowser.runtime.onMessage.trigger(message, {}, resolve);
    });
}

function mouse(target: Element | null | undefined, type: string, clientX: number, clientY: number) {
    target?.dispatchEvent(new MouseEvent(type, { clientX, clientY }));
}

function attributes(container: HTMLElement, selector: string, attribute: string) {
    return [ ...container.querySelectorAll(selector) ].map((el) => el.getAttribute(attribute));
}

function selectRange(startId: string, endId: string) {
    const range = document.createRange();
    range.setStartBefore(document.getElementById(startId) as Node);
    range.setEndAfter(document.getElementById(endId) as Node);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
}

function setUrl(url: string) {
    (window as unknown as HappyDOMWindow).happyDOM.setURL(url);
}
