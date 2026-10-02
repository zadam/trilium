import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { focusTitleIfNew, makeTitleEditable, NEW_NOTE_KEY } from "./guest_title.js";

describe("guest title", () => {
    beforeEach(() => {
        document.body.innerHTML = `<h1 id="title">New note</h1>`;
        sessionStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    function title() {
        const element = document.getElementById("title");
        if (!element) throw new Error("No title.");
        return element;
    }

    it("saves typing, hands Enter to the content and saves on leaving", () => {
        const saver = { scheduleTitle: vi.fn(), flush: vi.fn(async () => {}) };
        const content = { focusStart: vi.fn() };
        makeTitleEditable(saver, content);
        expect(title().contentEditable).toBe("true");

        title().textContent = "  Plans  ";
        title().dispatchEvent(new Event("input"));
        expect(saver.scheduleTitle).toHaveBeenCalledOnce();
        expect(saver.scheduleTitle.mock.calls[0][0]()).toBe("Plans");

        const enter = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
        title().dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(true);
        expect(content.focusStart).toHaveBeenCalledOnce();

        // Enter that ends an input method's composition stays with the composition.
        const composing = new KeyboardEvent("keydown", {
            key: "Enter", cancelable: true, isComposing: true
        });
        title().dispatchEvent(composing);
        expect(composing.defaultPrevented).toBe(false);
        expect(content.focusStart).toHaveBeenCalledOnce();

        title().dispatchEvent(new FocusEvent("blur"));
        expect(saver.flush).toHaveBeenCalledOnce();
    });

    it("selects a new note's title once, and leaves other pages' titles alone", () => {
        sessionStorage.setItem(NEW_NOTE_KEY, "other");
        focusTitleIfNew("n1");
        expect(document.activeElement).not.toBe(title());
        expect(sessionStorage.getItem(NEW_NOTE_KEY)).toBeNull();

        title().contentEditable = "true";
        sessionStorage.setItem(NEW_NOTE_KEY, "n1");
        focusTitleIfNew("n1");
        expect(document.activeElement).toBe(title());
        expect(window.getSelection()?.toString()).toBe("New note");
        expect(sessionStorage.getItem(NEW_NOTE_KEY)).toBeNull();
    });
});
