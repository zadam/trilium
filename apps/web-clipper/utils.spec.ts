import type { Window as HappyDOMWindow } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { createLink, extractPage, getPageLocationOrigin, randomString } from "./utils";

describe("randomString", () => {
    it("returns alphanumeric strings of the requested length", () => {
        expect(randomString(0)).toBe("");
        expect(randomString(20)).toMatch(/^[A-Za-z0-9]{20}$/);
        expect(randomString(20)).not.toBe(randomString(20));
    });
});

describe("getPageLocationOrigin", () => {
    afterEach(() => setUrl("about:blank"));

    it("returns the page's origin, and file:// for local files", () => {
        setUrl("https://example.com:8080/dir/page.html?q=1#hash");
        expect(getPageLocationOrigin()).toBe("https://example.com:8080");

        setUrl("file:///home/user/page.html");
        expect(getPageLocationOrigin()).toBe("file://");
    });
});

describe("createLink", () => {
    it("sends the click action to the extension", () => {
        const sendMessage = vi.spyOn(fakeBrowser.runtime, "sendMessage")
            .mockResolvedValue(undefined);
        const action = { name: "openNoteInTrilium", noteId: "abc" };

        const link = createLink(action, "Open");
        expect(link.textContent).toBe("Open");
        expect(link.style.color).toBe("lightskyblue");
        expect(createLink(action, "Close", "tomato").style.color).toBe("tomato");

        link.click();
        expect(sendMessage).toHaveBeenCalledWith(null, action);
    });
});


describe("extractPage", () => {
    afterEach(() => {
        Reflect.deleteProperty(fakeBrowser, "scripting");
        Reflect.deleteProperty(globalThis, "triliumReadPage");
    });

    it("injects the readable-page script, then reads the page as asked", async () => {
        const page = { title: "Article", content: "<p>Body</p>" };
        const readPage = vi.fn((variant: string) => variant === "article" ? page : undefined);
        const executeScript = vi.fn(async ({ func, args }: { func?: (variant: string) => unknown, args?: [ string ] }) => {
            if (!func || !args) return [];
            Object.assign(globalThis, { triliumReadPage: readPage });
            return [ { result: func(...args) } ];
        });
        Object.assign(fakeBrowser, { scripting: { executeScript } });

        expect(await extractPage(7, "article")).toBe(page);
        expect(executeScript.mock.calls.map(([ injection ]) => injection)).toEqual([
            { target: { tabId: 7 }, files: [ "/readable-page.js" ] },
            { target: { tabId: 7 }, func: expect.any(Function), args: [ "article" ] }
        ]);
        expect(await extractPage(7, "wholePage")).toBeUndefined();
        expect(readPage.mock.calls).toEqual([ [ "article" ], [ "wholePage" ] ]);

        executeScript.mockResolvedValue([]);
        expect(await extractPage(7, "article")).toBeUndefined();
    });
});

function setUrl(url: string) {
    (window as unknown as HappyDOMWindow).happyDOM.setURL(url);
}
