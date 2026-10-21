import {
    _setModelData as setModelData,
    ButtonView, type ClassicEditor, DropdownView, Essentials, Image, ImageStyle, ImageToolbar, IconPreviousArrow, IconTable, Paragraph, Table, TableCaption, TableToolbar,
    ToolbarSeparatorView, WidgetToolbarRepository
} from "ckeditor5";
import { describe, expect, it, vi } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import ContextToolbar from "./context_toolbar.js";
import ImagePosition from "./image_position.js";
import ToolbarGroupMenu, { type ToolbarGroupMenuRequest } from "./toolbar_group_menu.js";

const TABLE = "<table><tableRow><tableCell><paragraph>a[]</paragraph></tableCell></tableRow></table><paragraph>b</paragraph>";

describe("ContextToolbar", () => {
    async function createEditor(toolbar = ["undo", "contextToolbar"]) {
        const editor = await createTestEditor([Essentials, Paragraph, Table, TableCaption, TableToolbar, ContextToolbar], {
            toolbar,
            table: { contentToolbar: ["tableColumn", "tableRow"], tableToolbar: ["toggleTableCaption"] }
        });
        editor.ui.focusTracker.isFocused = true;
        return { editor, plugin: editor.plugins.get(ContextToolbar) };
    }

    it("shows its button while the selection is in a widget with a toolbar, in place of that toolbar's balloon", async () => {
        const { editor } = await createEditor();
        const button = getButton(editor);
        setModelData(editor.model, "<paragraph>b[]</paragraph>");
        editor.ui.update();
        expect(button.isVisible).toBe(false);

        setModelData(editor.model, TABLE);
        editor.ui.update();
        // A chip naming the widget, with the toolbar's own name as its tooltip.
        expect(button).toMatchObject({
            isVisible: true, label: "Table", withText: true, icon: IconTable, tooltip: "Table toolbar",
            class: "ck-context-toolbar-button"
        });
        expect(editor.plugins.get(WidgetToolbarRepository).isEnabled).toBe(false);
    });

    it("swaps in the items of that toolbar after a back button, and out from the back button", async () => {
        const { editor, plugin } = await createEditor();
        const button = getButton(editor);
        const focus = vi.spyOn(editor.editing.view, "focus");
        setModelData(editor.model, TABLE);
        editor.ui.update();

        button.fire("execute");
        expect(plugin.isActive).toBe(true);
        expect(focus).toHaveBeenCalledTimes(1);
        const [back, separator, ...items] = [...plugin.toolbarView.items];
        // The back button names the widget whose tools the row holds.
        expect(back).toMatchObject({ label: "Table", withText: true, icon: IconPreviousArrow, tooltip: "Back" });
        expect(separator).toBeInstanceOf(ToolbarSeparatorView);
        expect(items.map((item) => (item as { buttonView?: ButtonView }).buttonView?.label)).toStrictEqual(["Column", "Row"]);
        expect(editor.ui.focusTracker.elements).toContain(plugin.toolbarView.element);

        (back as ButtonView).fire("execute");
        expect(plugin.isActive).toBe(false);
        expect(focus).toHaveBeenCalledTimes(2);
    });

    it("follows the toolbar of the widget at the selection, and swaps out as the selection leaves it", async () => {
        const { editor, plugin } = await createEditor();
        const button = getButton(editor);
        setModelData(editor.model, "[<table><tableRow><tableCell><paragraph>a</paragraph></tableCell></tableRow></table>]<paragraph>b</paragraph>");
        editor.ui.update();
        button.fire("execute");
        expect([...plugin.toolbarView.items].slice(2).map((item) => (item as ButtonView).label))
            .toStrictEqual(["Toggle caption on"]);

        editor.model.change((writer) => writer.setSelection(editor.model.document.getRoot()?.getChild(1) ?? null, "end"));
        editor.ui.update();
        expect(plugin.isActive).toBe(false);
        expect(button.isVisible).toBe(false);
    });

    it("opens the lists of its dropdowns as menus of the app, in place of their panels", async () => {
        const requests: ToolbarGroupMenuRequest[] = [];
        const host = { show: vi.fn((request: ToolbarGroupMenuRequest) => requests.push(request)), hide: vi.fn(), destroy: vi.fn() };
        const editor = await createTestEditor(
            [Essentials, Paragraph, Table, TableToolbar, ContextToolbar, ToolbarGroupMenu],
            {
                toolbar: ["contextToolbar"],
                table: { contentToolbar: ["tableColumn"] },
                toolbarGroupMenu: { host: () => host }
            }
        );
        editor.ui.focusTracker.isFocused = true;
        setModelData(editor.model, TABLE);
        editor.ui.update();
        getButton(editor).fire("execute");

        const column = [...editor.plugins.get(ContextToolbar).toolbarView.items][2] as DropdownView;
        column.buttonView.fire("open");
        expect(column.isOpen).toBe(false);
        const rows = requests.at(-1)?.items ?? [];
        expect(rows.flatMap((row) => (row.kind === "entry" ? [row.label] : []))).toContain("Insert column left");
    });

    it("keeps the layout a dropdown asks for itself", async () => {
        const requests: ToolbarGroupMenuRequest[] = [];
        const host = { show: vi.fn((request: ToolbarGroupMenuRequest) => requests.push(request)), hide: vi.fn(), destroy: vi.fn() };
        const editor = await createTestEditor(
            [Essentials, Paragraph, Image, ImageStyle, ImageToolbar, ImagePosition, ContextToolbar, ToolbarGroupMenu],
            {
                toolbar: ["contextToolbar"],
                image: { toolbar: ["imagePosition"] },
                toolbarGroupMenu: { host: () => host }
            }
        );
        editor.ui.focusTracker.isFocused = true;
        setModelData(editor.model, "[<imageBlock src=\"a.png\"></imageBlock>]<paragraph>b</paragraph>");
        editor.ui.update();
        getButton(editor).fire("execute");

        const position = [...editor.plugins.get(ContextToolbar).toolbarView.items][2] as DropdownView;
        position.buttonView.fire("open");
        expect(requests.at(-1)?.layout).toBe("tiles");
    });

    it("swaps in on its own for a widget selected whole, and not for a caret inside one", async () => {
        const { editor, plugin } = await createEditor();
        const selectTable = () => setModelData(editor.model, `[${TABLE.replace("a[]", "a").replace("</table>", "</table>]")}`);
        const toCell = () => editor.model.change((writer) => {
            const cell = editor.model.document.getRoot()?.getNodeByPath([0, 0, 0, 0]);
            writer.setSelection(cell ?? null, "end");
        });
        const toParagraph = () => editor.model.change((writer) => {
            writer.setSelection(editor.model.document.getRoot()?.getChild(1) ?? null, "end");
        });

        setModelData(editor.model, TABLE);
        editor.ui.update();
        expect(plugin.isActive).toBe(false);

        selectTable();
        editor.ui.update();
        expect(plugin.isActive).toBe(true);
        expect([...plugin.toolbarView.items].slice(2).map((item) => (item as ButtonView).label))
            .toStrictEqual(["Toggle caption on"]);

        // The back button holds while the selection stays on the widget.
        ([...plugin.toolbarView.items][0] as ButtonView).fire("execute");
        editor.ui.update();
        expect(plugin.isActive).toBe(false);

        // Moving into a cell swaps nothing in; leaving and selecting the table again does.
        toCell();
        editor.ui.update();
        expect(plugin.isActive).toBe(false);
        toParagraph();
        editor.ui.update();
        selectTable();
        editor.ui.update();
        expect(plugin.isActive).toBe(true);
    });

    it("leaves the balloons alone in an editor without its button", async () => {
        const { editor } = await createEditor(["undo"]);
        expect(editor.plugins.get(WidgetToolbarRepository).isEnabled).toBe(true);
    });
});

function getButton(editor: ClassicEditor) {
    const item = [...editor.ui.view.toolbar.items].find((view) => view instanceof ButtonView && !view.label?.startsWith("Undo"));
    if (!(item instanceof ButtonView)) throw new Error("expected the context toolbar button");
    return item;
}
