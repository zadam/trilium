import {
    Bold, ButtonView, type ClassicEditor, Essentials, IconPreviousArrow, IconText, Italic, Paragraph,
    ToolbarSeparatorView
} from "ckeditor5";
import { describe, expect, it, vi } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import TextFormattingToolbar from "./text_formatting_toolbar.js";
import ToolbarGroupMenu, { type ToolbarGroupMenuRequest } from "./toolbar_group_menu.js";

describe("TextFormattingToolbar", () => {
    async function createEditor(extraConfig = {}) {
        const editor = await createTestEditor([Essentials, Paragraph, Bold, Italic, TextFormattingToolbar], {
            toolbar: ["textFormatting", "italic"],
            textFormattingToolbar: ["bold", "|", "italic"],
            ...extraConfig
        });
        return { editor, plugin: editor.plugins.get(TextFormattingToolbar) };
    }

    it("holds a back button, a separator and the configured items, rendered and tracked by the editor", async () => {
        const { editor, plugin } = await createEditor();
        const [back, separator, bold, rule, italic] = [...plugin.toolbarView.items];

        expect(back).toBeInstanceOf(ButtonView);
        expect(back).toMatchObject({ label: "Back", icon: IconPreviousArrow, tooltip: true });
        expect(separator).toBeInstanceOf(ToolbarSeparatorView);
        expect((bold as ButtonView).label).toBe("Bold");
        expect(rule).toBeInstanceOf(ToolbarSeparatorView);
        expect((italic as ButtonView).label).toBe("Italic");

        const element = plugin.toolbarView.element;
        expect(element).not.toBeNull();
        expect(editor.ui.focusTracker.elements).toContain(element);
    });

    it("swaps in from its button and out from the back button, keeping the editor focused", async () => {
        const { editor, plugin } = await createEditor();
        const focus = vi.spyOn(editor.editing.view, "focus");
        const button = getToolbarButton(editor, 0);
        expect(button).toMatchObject({ label: "Text formatting", icon: IconText, tooltip: true });
        expect(plugin.isActive).toBe(false);

        button.fire("execute");
        expect(plugin.isActive).toBe(true);
        expect(focus).toHaveBeenCalledTimes(1);

        (plugin.toolbarView.items.first as ButtonView).fire("execute");
        expect(plugin.isActive).toBe(false);
        expect(focus).toHaveBeenCalledTimes(2);
    });

    it("holds only the back button when no items are configured", async () => {
        const editor = await createTestEditor([Essentials, Paragraph, TextFormattingToolbar], {
            toolbar: ["textFormatting"]
        });
        expect(editor.plugins.get(TextFormattingToolbar).toolbarView.items.length).toBe(1);
    });

    it("lets ToolbarGroupMenu open its groups marked asMenu", async () => {
        const requests: ToolbarGroupMenuRequest[] = [];
        const host = { show: vi.fn((request: ToolbarGroupMenuRequest) => requests.push(request)), hide: vi.fn(), destroy: vi.fn() };
        const editor = await createTestEditor([Essentials, Paragraph, Bold, Italic, TextFormattingToolbar, ToolbarGroupMenu], {
            toolbar: ["textFormatting"],
            textFormattingToolbar: [{ label: "More", icon: "text", asMenu: true, items: ["bold", "italic"] }],
            toolbarGroupMenu: { host: () => host }
        });

        const group = editor.plugins.get(TextFormattingToolbar).toolbarView.items.last as unknown as {
            buttonView: ButtonView; isOpen: boolean;
        };
        group.buttonView.fire("open");
        expect(group.isOpen).toBe(false);
        expect(requests.at(-1)?.items.map((item) => item.kind === "entry" && item.label)).toStrictEqual(["Bold", "Italic"]);
    });

    it("destroys its toolbar with the editor", async () => {
        const { editor, plugin } = await createEditor();
        const destroy = vi.spyOn(plugin.toolbarView, "destroy");
        await editor.destroy();
        expect(destroy).toHaveBeenCalled();
    });
});

function getToolbarButton(editor: ClassicEditor, index: number) {
    const item = editor.ui.view.toolbar.items.get(index);
    if (!(item instanceof ButtonView)) {
        throw new Error(`toolbar item ${index} is not a button`);
    }
    return item;
}
