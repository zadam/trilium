import {
    _setModelData as setModelData,
    ButtonView, type ClassicEditor, ContextualBalloon, DropdownView, Essentials, IconLink, Image, ImageStyle, ImageToolbar,
    IconBulletedList, IconNumberedList, IconPreviousArrow, IconTodoList, IconTable, Link, LinkUI, List, ListProperties, Paragraph, TodoList, Table, TableCaption, TableToolbar, ToolbarSeparatorView,
    WidgetToolbarRepository
} from "ckeditor5";
import { describe, expect, it, vi } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import { installGlobMock } from "../../test/globals-test-kit.js";
import ContextToolbar from "./context_toolbar.js";
import ImagePosition from "./image_position.js";
import LinkEmbedToolbar from "./link_embed/link_embed_toolbar.js";
import MobileToolbarItems from "./mobile_toolbar_items.js";
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
        const [back, separator, chip, ...items] = [...plugin.toolbarView.items];
        expect(back).toMatchObject({ label: "Back", withText: false, icon: IconPreviousArrow, tooltip: true });
        // A title naming the widget the tools act on, which is not a button.
        expect(chip).not.toBeInstanceOf(ButtonView);
        expect(chip).toMatchObject({ isVisible: true, label: "Table", icon: IconTable });
        expect(chip.element?.classList).toContain("ck-context-toolbar-title");
        expect(chip.element?.textContent).toBe("Table");
        expect(chip.element?.querySelector("svg")).not.toBeNull();
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
        expect([...plugin.toolbarView.items].slice(3).map((item) => (item as ButtonView).label))
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

        const column = [...editor.plugins.get(ContextToolbar).toolbarView.items][3] as DropdownView;
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

        const position = [...editor.plugins.get(ContextToolbar).toolbarView.items][3] as DropdownView;
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
        expect([...plugin.toolbarView.items].slice(3).map((item) => (item as ButtonView).label))
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

    it("offers the list toolbar for the innermost list, to-do lists included", async () => {
        const editor = await createTestEditor([Essentials, Paragraph, List, ListProperties, TodoList, MobileToolbarItems, ContextToolbar], {
            toolbar: ["contextToolbar"],
            list: { properties: { styles: true, startIndex: true, reversed: true } },
            listToolbar: ["listTypeMenu", "listReversed"]
        });
        editor.ui.focusTracker.isFocused = true;
        const plugin = editor.plugins.get(ContextToolbar);
        const button = getButton(editor);

        setModelData(editor.model,
            "<paragraph listIndent=\"0\" listItemId=\"a\" listType=\"bulleted\">a</paragraph>"
            + "<paragraph listIndent=\"1\" listItemId=\"b\" listType=\"numbered\">b[]</paragraph>");
        editor.ui.update();
        expect(button).toMatchObject({ isVisible: true, label: "List", icon: IconNumberedList });
        // A caret in a list is in text, so the row waits for the chip.
        expect(plugin.isActive).toBe(false);
        button.fire("execute");
        expect([...plugin.toolbarView.items].slice(3).map((item) => (item as ButtonView).label))
            .toStrictEqual([undefined, "Reversed order"]);

        setModelData(editor.model, "<paragraph listIndent=\"0\" listItemId=\"a\" listType=\"bulleted\">a[]</paragraph>");
        editor.ui.update();
        expect(button).toMatchObject({ isVisible: true, icon: IconBulletedList });

        setModelData(editor.model, "<paragraph listIndent=\"0\" listItemId=\"a\" listType=\"todo\">a[]</paragraph>");
        editor.ui.update();
        expect(button).toMatchObject({ isVisible: true, label: "List", icon: IconTodoList });

        setModelData(editor.model, "<paragraph>a[]</paragraph>");
        editor.ui.update();
        expect(button.isVisible).toBe(false);
    });

    describe("for a link", () => {
        async function createLinkEditor(toolbar = ["undo", "contextToolbar"]) {
            const editor = await createTestEditor([Essentials, Paragraph, Link, ContextToolbar], {
                toolbar,
                link: { toolbar: ["editLink", "linkProperties", "unlink"] }
            });
            editor.ui.focusTracker.isFocused = true;
            setModelData(editor.model, "<paragraph><$text linkHref=\"https://a.b\">li[]nk</$text> text</paragraph>");
            editor.ui.update();
            return editor;
        }

        it("offers the link toolbar as a chip while the caret is in a link, leaving out what the link cannot use", async () => {
            const editor = await createLinkEditor();
            const plugin = editor.plugins.get(ContextToolbar);
            const button = getButton(editor);
            expect(button).toMatchObject({ isVisible: true, label: "Link", icon: IconLink, withText: true });
            // A caret in a link is in text, so the row waits for the chip.
            expect(plugin.isActive).toBe(false);

            button.fire("execute");
            expect([...plugin.toolbarView.items].slice(3).map((item) => (item as ButtonView).label))
                .toStrictEqual(["Edit link", "Unlink"]);

            editor.model.change((writer) => writer.setSelection(editor.model.document.getRoot()?.getChild(0) ?? null, "end"));
            editor.ui.update();
            expect(plugin.isActive).toBe(false);
            expect(button.isVisible).toBe(false);
        });

        it("swaps in on a tap in the link, which is about the link rather than its text", async () => {
            const editor = await createLinkEditor();
            const plugin = editor.plugins.get(ContextToolbar);

            click(editor);
            expect(plugin.isActive).toBe(true);
            expect([...plugin.toolbarView.items].slice(3).map((item) => (item as ButtonView).label))
                .toStrictEqual(["Edit link", "Unlink"]);

            // The back button holds while the caret stays in the link, until the next tap.
            ([...plugin.toolbarView.items][0] as ButtonView).fire("execute");
            editor.ui.update();
            expect(plugin.isActive).toBe(false);
            click(editor);
            expect(plugin.isActive).toBe(true);

            // A tap outside any link swaps nothing in.
            editor.model.change((writer) => writer.setSelection(editor.model.document.getRoot()?.getChild(0) ?? null, "end"));
            editor.ui.update();
            click(editor);
            expect(plugin.isActive).toBe(false);
        });

        it("keeps the link toolbar out of the balloon, and leaves its form there", async () => {
            const editor = await createLinkEditor();
            const balloon = editor.plugins.get(ContextualBalloon);
            const linkUI = editor.plugins.get(LinkUI);

            click(editor);
            await Promise.resolve();
            expect(linkUI.toolbarView).not.toBeNull();
            expect(linkUI.toolbarView && balloon.hasView(linkUI.toolbarView)).toBe(false);

            getButton(editor).fire("execute");
            const edit = [...editor.plugins.get(ContextToolbar).toolbarView.items][3] as ButtonView;
            edit.fire("execute");
            expect(balloon.visibleView).toBe(linkUI.formView);

            // Without the chip, CKEditor's balloon is left as it is.
            const desktop = await createLinkEditor(["undo"]);
            click(desktop);
            await Promise.resolve();
            const desktopUI = desktop.plugins.get(LinkUI);
            expect(desktop.plugins.get(ContextualBalloon).visibleView).toBe(desktopUI.toolbarView);
        });
    });

    it("names the toolbar of a link preview after the link it is", async () => {
        installGlobMock({ getComponentByEl: () => ({ renderLinkMention: vi.fn(), detectEmbedType: () => "opengraph" }) });
        const editor = await createTestEditor([Essentials, Paragraph, LinkEmbedToolbar, ContextToolbar], {
            toolbar: ["contextToolbar"]
        });
        editor.ui.focusTracker.isFocused = true;
        setModelData(editor.model, "<paragraph>a[<linkMention url=\"https://a.b\"></linkMention>]b</paragraph>");
        editor.ui.update();

        expect(getButton(editor)).toMatchObject({ isVisible: true, label: "Link", icon: IconLink });
        expect([...editor.plugins.get(ContextToolbar).toolbarView.items][2]).toMatchObject({ label: "Link" });
    });

    it("leaves the balloons alone in an editor without its button", async () => {
        const { editor } = await createEditor(["undo"]);
        expect(editor.plugins.get(WidgetToolbarRepository).isEnabled).toBe(true);
    });
});

/** A click in the editing view, as `LinkUI` opens its toolbar on. */
function click(editor: ClassicEditor) {
    const domEvent = new MouseEvent("click");
    editor.editing.view.document.fire("click", {
        domEvent, domTarget: document.body, preventDefault: () => undefined, stopPropagation: () => undefined
    });
}

function getButton(editor: ClassicEditor) {
    const item = [...editor.ui.view.toolbar.items].find((view) => view instanceof ButtonView && !view.label?.startsWith("Undo"));
    if (!(item instanceof ButtonView)) throw new Error("expected the context toolbar button");
    return item;
}
