import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderInto } from "../../test/render";

const platform = vi.hoisted(() => ({ isMobileApp: true, isIOS: true }));

vi.mock("../../services/utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../services/utils")>()),
    isMobileApp: () => platform.isMobileApp,
    isIOS: () => platform.isIOS
}));

vi.mock("../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks")>()),
    useStaticTooltip: vi.fn()
}));

import HideKeyboardButton, { isEditable } from "./hide_keyboard_button";

describe("HideKeyboardButton", () => {
    afterEach(() => {
        platform.isMobileApp = true;
        platform.isIOS = true;
        for (const element of added) element.remove();
        added.length = 0;
    });

    const added: HTMLElement[] = [];

    function attach(...elements: HTMLElement[]) {
        document.body.append(...elements);
        added.push(...elements);
    }

    function mount() {
        let container: HTMLElement | undefined;
        act(() => { container = renderInto(<HideKeyboardButton />); });
        if (!container) throw new Error("not rendered");
        return container;
    }

    function focus(element: HTMLElement) {
        act(() => element.focus());
    }

    it("shows while an editable element has the focus and blurs it when pressed", () => {
        const input = document.createElement("input");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        attach(input, checkbox);
        const container = mount();

        expect(container.querySelector("button")).toBeNull();

        focus(input);
        const button = container.querySelector("button");
        expect(button).not.toBeNull();

        const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        button?.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);

        act(() => button?.click());
        expect(document.activeElement).not.toBe(input);
        expect(container.querySelector("button")).toBeNull();

        focus(input);
        expect(container.querySelector("button")).not.toBeNull();
        focus(checkbox);
        expect(container.querySelector("button")).toBeNull();
    });

    it("stays away outside the iOS app", () => {
        const input = document.createElement("input");
        attach(input);

        platform.isIOS = false;
        const android = mount();
        platform.isIOS = true;
        platform.isMobileApp = false;
        const safari = mount();

        focus(input);
        expect(android.querySelector("button")).toBeNull();
        expect(safari.querySelector("button")).toBeNull();
    });

    it("counts only elements that take typed text as editable", () => {
        const make = <K extends keyof HTMLElementTagNameMap>(tag: K, setup?: (el: HTMLElementTagNameMap[K]) => void) => {
            const element = document.createElement(tag);
            setup?.(element);
            return element;
        };

        expect(isEditable(make("input"))).toBe(true);
        expect(isEditable(make("input", (el) => { el.type = "search"; }))).toBe(true);
        expect(isEditable(make("textarea"))).toBe(true);
        expect(isEditable(make("div", (el) => { el.contentEditable = "true"; }))).toBe(true);

        expect(isEditable(make("input", (el) => { el.type = "checkbox"; }))).toBe(false);
        expect(isEditable(make("input", (el) => { el.readOnly = true; }))).toBe(false);
        expect(isEditable(make("textarea", (el) => { el.disabled = true; }))).toBe(false);
        expect(isEditable(make("div"))).toBe(false);
        expect(isEditable(make("button"))).toBe(false);
        expect(isEditable(null)).toBe(false);
    });
});
