import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderInto } from "../../test/render";

vi.mock("../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks")>()),
    useStaticTooltip: vi.fn()
}));

import HideKeyboardButton from "./hide_keyboard_button";

describe("HideKeyboardButton", () => {
    let input: HTMLInputElement | undefined;

    afterEach(() => {
        input?.remove();
    });

    it("blurs the focus when pressed, without taking it first", () => {
        input = document.createElement("input");
        document.body.append(input);
        let container: HTMLElement | undefined;
        act(() => { container = renderInto(<HideKeyboardButton />); });

        const button = container?.querySelector("button");
        expect(button).toBeInstanceOf(HTMLButtonElement);

        const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        button?.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);

        act(() => input?.focus());
        expect(document.activeElement).toBe(input);
        act(() => button?.click());
        expect(document.activeElement).not.toBe(input);
    });
});
