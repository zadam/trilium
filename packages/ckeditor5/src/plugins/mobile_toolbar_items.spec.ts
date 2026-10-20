import {
    _getModelData as getModelData,
    _setModelData as setModelData,
    BlockQuote,
    ClassicEditor,
    CodeBlock,
    DropdownView,
    Essentials,
    FontSize,
    Heading,
    HorizontalLine,
    IconBulletedList,
    IconCodeBlock,
    IconHeading2,
    IconHeading3,
    IconNumberedList,
    IconParagraph,
    IconQuote,
    IconTodoList,
    List,
    Paragraph,
    TodoList
} from "ckeditor5";
import editorStylesheetUrl from "ckeditor5/ckeditor5.css?url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestEditor } from "../../test/editor-kit.js";
import admonitionIcon from "../icons/admonition.svg?raw";
import AdmonitionEditing from "./admonition/admonition_editing.js";
import MobileToolbarItems from "./mobile_toolbar_items.js";
import ToolbarGroupMenu, { type ToolbarGroupMenuEntry, type ToolbarGroupMenuItem, type ToolbarGroupMenuRequest } from "./toolbar_group_menu.js";

const HEADING_OPTIONS = [
    { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
    { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
    { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" }
] as const;

const BULLETED = "<paragraph listIndent=\"0\" listItemId=\"a00\" listType=\"bulleted\">foo[]</paragraph>";

describe("MobileToolbarItems", () => {
    let editor: ClassicEditor;

    // The width of the dropdown button needs the editor's stylesheet.
    beforeAll(() => new Promise<void>((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = editorStylesheetUrl;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error("the editor stylesheet did not load"));
        document.head.appendChild(link);
    }));

    beforeEach(async () => {
        editor = await createTestEditor([Essentials, Paragraph, Heading, List, TodoList, HorizontalLine, MobileToolbarItems], {
            toolbar: ["heading", "blockType"],
            heading: { options: [...HEADING_OPTIONS] }
        });
    });

    describe("blockType", () => {
        it("shows the type of the current block as an icon, with its name in the accessible label", () => {
            const { buttonView } = getDropdown(editor, 1);
            expect(buttonView.withText).toBe(false);
            expect(buttonView.tooltip).toBe("Block type");

            const icons: [string, string, string][] = [
                ["<paragraph>foo[]</paragraph>", IconParagraph, "Paragraph"],
                ["<heading2>foo[]</heading2>", IconHeading2, "Heading 2"],
                [BULLETED, IconBulletedList, "Bulleted List"],
                [BULLETED.replace("bulleted", "numbered"), IconNumberedList, "Numbered List"],
                [BULLETED.replace("bulleted", "todo"), IconTodoList, "To-do List"],
                ["<codeBlock language=\"plaintext\">foo[]</codeBlock>", IconCodeBlock, "Code block"],
                // A wrapper leaves the button to the block inside it.
                ["<blockQuote><heading2>foo[]</heading2></blockQuote>", IconHeading2, "Heading 2"]
            ];
            for (const [data, icon, name] of icons) {
                setModelData(editor.model, data);
                expect(buttonView.icon).toBe(icon);
                expect(buttonView.ariaLabel).toBe(`${name}, Block type`);
            }
            expect(buttonView.element?.querySelector(".ck-button__icon")).not.toBeNull();

            // A block that is none of them, such as a horizontal line.
            setModelData(editor.model, "<paragraph>foo</paragraph>[<horizontalLine></horizontalLine>]");
            expect(buttonView.icon).toBe(IconParagraph);
            expect(buttonView.ariaLabel).toBe("Block type");
        });

        it("lists the headings, the lists, then code and the wrappers, each with its icon and the current block on", async () => {
            const { request, editor: menuEditor } = await createMenuEditor();
            setModelData(menuEditor.model, BULLETED);

            const shown = request();
            expect(shown.layout).toBe("tiles");
            const rows = shown.items;
            expect(rows.map(rowText)).toStrictEqual([
                "Paragraph", "Heading 2", "Heading 3", "—", "Bulleted List ✓", "Numbered List", "To-do List",
                "—", "Code block", "Block quote", "Admonition"
            ]);
            expect(icons(rows)).toStrictEqual([
                IconParagraph, IconHeading2, IconHeading3, IconBulletedList, IconNumberedList, IconTodoList,
                IconCodeBlock, IconQuote, admonitionIcon
            ]);

            // A wrapper is on alongside the block inside it.
            setModelData(menuEditor.model, `<blockQuote>${BULLETED}</blockQuote>`);
            expect(request().items.map(rowText).filter((row) => row.endsWith("✓")))
                .toStrictEqual(["Bulleted List ✓", "Block quote ✓"]);
            setModelData(menuEditor.model, "<aside admonitionType=\"tip\"><paragraph>foo[]</paragraph></aside>");
            expect(request().items.map(rowText).filter((row) => row.endsWith("✓")))
                .toStrictEqual(["Paragraph ✓", "Admonition ✓"]);

            setModelData(menuEditor.model, "<heading2>foo[]</heading2>");
            expect(request().items.map(rowText).filter((row) => row.endsWith("✓"))).toStrictEqual(["Heading 2 ✓"]);
            setModelData(menuEditor.model, "<paragraph>foo[]</paragraph>");
            expect(request().items.map(rowText).filter((row) => row.endsWith("✓"))).toStrictEqual(["Paragraph ✓"]);
        });

        it("turns any block into any other, a list into plain text, each in one undo step", async () => {
            const { request, editor: menuEditor } = await createMenuEditor();
            const run = (label: string) => entry(request().items, label).run?.();
            const model = () => getModelData(menuEditor.model, { withoutSelection: true });
            const listOf = (type: string) =>
                new RegExp(`^<paragraph listIndent="0" listItemId="[^"]+" listType="${type}">foo</paragraph>$`);

            setModelData(menuEditor.model, "<paragraph>foo[]</paragraph>");
            run("Bulleted List");
            expect(model()).toMatch(listOf("bulleted"));
            run("Numbered List");
            expect(model()).toMatch(listOf("numbered"));

            // A heading or a paragraph picked in a list leaves the list, as Notion's "Turn into" does.
            run("Heading 2");
            expect(model()).toBe("<heading2>foo</heading2>");
            run("To-do List");
            expect(model()).toMatch(listOf("todo"));
            run("Paragraph");
            expect(model()).toBe("<paragraph>foo</paragraph>");

            // A code block is a block type of its own, which a list or a heading leaves.
            run("Numbered List");
            run("Code block");
            expect(model()).toBe("<codeBlock language=\"plaintext\">foo</codeBlock>");
            run("Code block");
            expect(model()).toBe("<codeBlock language=\"plaintext\">foo</codeBlock>");
            run("Bulleted List");
            expect(model()).toMatch(listOf("bulleted"));
            run("Code block");
            run("Heading 2");
            expect(model()).toBe("<heading2>foo</heading2>");

            // The wrappers wrap the block, and unwrap it when picked again.
            run("Block quote");
            expect(model()).toBe("<blockQuote><heading2>foo</heading2></blockQuote>");
            run("Block quote");
            expect(model()).toBe("<heading2>foo</heading2>");
            run("Admonition");
            expect(model()).toBe("<aside admonitionType=\"note\"><heading2>foo</heading2></aside>");
            run("Admonition");
            expect(model()).toBe("<heading2>foo</heading2>");

            run("Heading 3");
            run("Bulleted List");
            menuEditor.execute("undo");
            expect(model()).toBe("<heading3>foo</heading3>");
        });

        it("opens CKEditor's own panel without a host, whose rows switch the block", () => {
            setModelData(editor.model, "<paragraph>foo[]</paragraph>");
            const dropdown = getDropdown(editor, 1);
            dropdown.isOpen = true;

            const labels = [...dropdown.element?.querySelectorAll(".ck-list__item .ck-button__label") ?? []];
            expect(labels.map((label) => label.textContent)).toStrictEqual([
                "Paragraph", "Heading 2", "Heading 3", "Bulleted List", "Numbered List", "To-do List",
                "Code block", "Block quote", "Admonition"
            ]);

            dropdown.element?.querySelectorAll<HTMLElement>(".ck-list__item .ck-button")[1]?.click();
            expect(editor.getData()).toBe("<h2>foo</h2>");
        });

        it("is enabled while any block type can be set", () => {
            const dropdown = getDropdown(editor, 1);
            expect(dropdown.isEnabled).toBe(true);
            editor.enableReadOnlyMode("spec");
            expect(dropdown.isEnabled).toBe(false);
        });

        it("is narrower than the heading dropdown", () => {
            setModelData(editor.model, "<paragraph>foo[]</paragraph>");
            const full = getDropdown(editor, 0).buttonView.element?.getBoundingClientRect().width ?? 0;
            const compact = getDropdown(editor, 1).buttonView.element?.getBoundingClientRect().width ?? 0;

            expect(full).toBeGreaterThan(100);
            expect(compact).toBeGreaterThan(0);
            expect(compact).toBeLessThan(full / 2);
        });
    });

    it("opens the font size list as a menu of the app, each row naming its size class and the current one on", async () => {
        const requests: ToolbarGroupMenuRequest[] = [];
        const host = { show: vi.fn((request: ToolbarGroupMenuRequest) => requests.push(request)), hide: vi.fn(), destroy: vi.fn() };
        const menuEditor = await createTestEditor([Essentials, Paragraph, FontSize, MobileToolbarItems, ToolbarGroupMenu], {
            toolbar: ["fontSizeMenu"],
            toolbarGroupMenu: { host: () => host }
        });
        setModelData(menuEditor.model, "<paragraph>[<$text fontSize=\"big\">foo</$text>]</paragraph>");

        const dropdown = getDropdown(menuEditor, 0);
        dropdown.buttonView.fire("open");
        expect(dropdown.isOpen).toBe(false);

        const rows = (requests.at(-1)?.items ?? []) as ToolbarGroupMenuEntry[];
        expect(rows.map(({ label, isOn }) => ({ label, isOn }))).toStrictEqual([
            { label: "Tiny", isOn: false },
            { label: "Small", isOn: false },
            { label: "Default", isOn: false },
            { label: "Big", isOn: true },
            { label: "Huge", isOn: false }
        ]);
        expect(rows[0]?.className).toBe("ck-fontsize-option text-tiny");

        rows[4]?.run?.();
        expect(menuEditor.getData()).toBe("<p><span class=\"text-huge\">foo</span></p>");
    });
});

/** An editor whose `blockType` opens as a menu of the app; `request()` opens it and returns what the host was given. */
async function createMenuEditor() {
    const requests: ToolbarGroupMenuRequest[] = [];
    const host = { show: vi.fn((request: ToolbarGroupMenuRequest) => requests.push(request)), hide: vi.fn(), destroy: vi.fn() };
    const menuEditor = await createTestEditor(
        [Essentials, Paragraph, Heading, List, TodoList, MobileToolbarItems, ToolbarGroupMenu],
        {
            toolbar: ["blockType"],
            heading: { options: [...HEADING_OPTIONS] },
            toolbarGroupMenu: { host: () => host }
        }
    );
    const request = () => {
        getDropdown(menuEditor, 0).buttonView.fire("open");
        const shown = requests.at(-1);
        requests.at(-1)?.onClose(false);
        if (!shown) throw new Error("The host was asked to show no menu.");
        return shown;
    };
    return { editor: menuEditor, request };
}

/** A row as its label, with a check when it is on, or a rule as an em dash. */
function rowText(item: ToolbarGroupMenuItem) {
    if (item.kind === "separator") return "—";
    return item.isOn ? `${item.label} ✓` : item.label;
}

function icons(items: ToolbarGroupMenuItem[]) {
    return items.flatMap((item) => (item.kind === "entry" ? [item.icon] : []));
}

function entry(items: ToolbarGroupMenuItem[], label: string) {
    const found = items.find((item): item is ToolbarGroupMenuEntry => item.kind === "entry" && item.label === label);
    if (!found) throw new Error(`No "${label}" row in the menu.`);
    return found;
}

function getDropdown(editor: ClassicEditor, index: number) {
    const item = editor.ui.view.toolbar.items.get(index);
    if (!(item instanceof DropdownView)) {
        throw new Error(`toolbar item ${index} is not a dropdown`);
    }
    return item;
}
