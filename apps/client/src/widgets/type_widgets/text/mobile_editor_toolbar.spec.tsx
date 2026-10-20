import type { CKTextEditor } from "@triliumnext/ckeditor5";
import { render } from "preact";
import { act } from "preact/test-utils";
import { describe, expect, it } from "vitest";

import { useEditorsFocused, useShownToolbarElement } from "./mobile_editor_toolbar";

describe("useEditorsFocused", () => {
    it("follows the focus trackers of both editors, and stops once unmounted", () => {
        const noteEditor = buildEditor();
        const nestedEditor = buildEditor();
        const seen: boolean[] = [];
        const host = document.createElement("div");
        function Harness({ nested }: { nested: CKTextEditor | null }) {
            seen.push(useEditorsFocused(noteEditor.editor, nested));
            return null;
        }

        act(() => render(<Harness nested={null} />, host));
        expect(seen.at(-1)).toBe(false);

        act(() => noteEditor.setFocused(true));
        expect(seen.at(-1)).toBe(true);
        act(() => noteEditor.setFocused(false));
        expect(seen.at(-1)).toBe(false);

        // The toolbar of a nested editor lies outside the editable of the note's editor.
        act(() => render(<Harness nested={nestedEditor.editor} />, host));
        act(() => nestedEditor.setFocused(true));
        expect(seen.at(-1)).toBe(true);

        // An editor focused before the hook subscribes counts from the start.
        act(() => render(null, host));
        act(() => render(<Harness nested={nestedEditor.editor} />, host));
        expect(seen.at(-1)).toBe(true);

        act(() => render(null, host));
        expect(noteEditor.listenerCount()).toBe(0);
        expect(nestedEditor.listenerCount()).toBe(0);
    });
});

describe("useShownToolbarElement", () => {
    it("shows the editor's toolbar, and the text formatting one while that is active", () => {
        const main = document.createElement("div");
        const formatting = document.createElement("div");
        const listeners = new Set<() => void>();
        const plugin = {
            isActive: false,
            toolbarView: { element: formatting },
            on: (_event: string, listener: () => void) => listeners.add(listener),
            off: (_event: string, listener: () => void) => listeners.delete(listener)
        };
        const setActive = (isActive: boolean) => {
            plugin.isActive = isActive;
            for (const listener of listeners) listener();
        };
        const withPlugin = {
            ui: { view: { toolbar: { element: main } } },
            plugins: { has: () => true, get: () => plugin }
        } as unknown as CKTextEditor;
        const withoutPlugin = {
            ui: { view: { toolbar: { element: main } } },
            plugins: { has: () => false }
        } as unknown as CKTextEditor;

        const seen: (HTMLElement | undefined)[] = [];
        const host = document.createElement("div");
        function Harness({ editor }: { editor: CKTextEditor | undefined }) {
            seen.push(useShownToolbarElement(editor));
            return null;
        }

        act(() => render(<Harness editor={undefined} />, host));
        expect(seen.at(-1)).toBeUndefined();

        act(() => render(<Harness editor={withPlugin} />, host));
        expect(seen.at(-1)).toBe(main);
        act(() => setActive(true));
        expect(seen.at(-1)).toBe(formatting);
        act(() => setActive(false));
        expect(seen.at(-1)).toBe(main);

        // An editor whose formatting toolbar was left active shows it from the start.
        act(() => setActive(true));
        act(() => render(<Harness editor={withoutPlugin} />, host));
        expect(seen.at(-1)).toBe(main);
        act(() => render(<Harness editor={withPlugin} />, host));
        expect(seen.at(-1)).toBe(formatting);

        act(() => render(null, host));
        expect(listeners.size).toBe(0);
    });
});

function buildEditor() {
    const listeners = new Set<() => void>();
    const focusTracker = {
        isFocused: false,
        on: (_event: string, listener: () => void) => listeners.add(listener),
        off: (_event: string, listener: () => void) => listeners.delete(listener)
    };
    return {
        editor: { ui: { focusTracker } } as unknown as CKTextEditor,
        setFocused(isFocused: boolean) {
            focusTracker.isFocused = isFocused;
            for (const listener of listeners) {
                listener();
            }
        },
        listenerCount: () => listeners.size
    };
}
