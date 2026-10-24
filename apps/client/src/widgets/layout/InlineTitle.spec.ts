import { afterEach, describe, expect, it, vi } from "vitest";

import { buildNote } from "../../test/easy-froca";
import { observeTitleInView, shouldShowInlineTitle } from "./InlineTitle";

describe("shouldShowInlineTitle", () => {
    const viewScope = { viewMode: "default" } as const;

    it("carries text notes only, since a code note fills the pane and scrolls its own editor", () => {
        const textNote = buildNote({ title: "Note", type: "text" });
        const codeNote = buildNote({ title: "Script", type: "code", mime: "application/javascript;env=backend" });

        expect(shouldShowInlineTitle(textNote, "text", viewScope)).toBe(true);
        expect(shouldShowInlineTitle(codeNote, "code", viewScope)).toBe(false);
    });
});

describe("observeTitleInView", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = "";
    });

    it("measures the title against its scrolling container, which a sliding note carries along", () => {
        const observers: { options?: IntersectionObserverInit; callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
        vi.stubGlobal("IntersectionObserver", class {
            disconnect = vi.fn();
            observe = vi.fn();
            constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
                observers.push({ callback, options, disconnect: this.disconnect });
            }
        });
        const container = document.body.appendChild(document.createElement("div"));
        container.className = "scrolling-container";
        const title = container.appendChild(document.createElement("div"));
        const onChange = vi.fn();

        const stop = observeTitleInView(title, onChange);
        const [ observer ] = observers;
        expect(observer.options?.root).toBe(container);

        observer.callback([ { isIntersecting: false } as IntersectionObserverEntry ], {} as IntersectionObserver);
        expect(onChange).toHaveBeenLastCalledWith(false);

        stop();
        expect(observer.disconnect).toHaveBeenCalled();
    });
});
