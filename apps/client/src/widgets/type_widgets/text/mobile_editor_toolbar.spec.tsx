import type { CKTextEditor } from "@triliumnext/ckeditor5";
import { render } from "preact";
import { act } from "preact/test-utils";
import { describe, expect, it } from "vitest";

import { useEditorsFocused } from "./mobile_editor_toolbar";

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
