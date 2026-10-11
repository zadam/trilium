import type { Window as HappyDOMWindow } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { createLink, extractReadablePage, getPageLocationOrigin, randomString } from "./utils";

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


describe("extractReadablePage", () => {
    afterEach(() => {
        Reflect.deleteProperty(fakeBrowser, "scripting");
    });

    it("runs the readable-page script in the tab and returns its result", async () => {
        const page = { title: "Article", content: "<p>Body</p>" };
        const executeScript = vi.fn()
            .mockResolvedValueOnce([ { result: page } ])
            .mockResolvedValueOnce([ { result: null } ])
            .mockResolvedValueOnce([]);
        Object.assign(fakeBrowser, { scripting: { executeScript } });

        expect(await extractReadablePage(7)).toBe(page);
        expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: [ "/readable-page.js" ] });
        expect(await extractReadablePage(7)).toBeUndefined();
        expect(await extractReadablePage(7)).toBeUndefined();
    });
});

function setUrl(url: string) {
    (window as unknown as HappyDOMWindow).happyDOM.setURL(url);
}
