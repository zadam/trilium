import {
    _getLocalizedHeadingOptions as getLocalizedHeadingOptions,
    addListToDropdown,
    Alignment,
    BlockQuote,
    CodeBlock,
    Collection,
    createDropdown,
    FontSize,
    Heading,
    IconBulletedList,
    IconCodeBlock,
    IconHeading1,
    IconHeading2,
    IconHeading3,
    IconHeading4,
    IconHeading5,
    IconHeading6,
    IconNumberedList,
    IconParagraph,
    IconQuote,
    IconTodoList,
    List,
    Plugin,
    TodoList,
    UIModel
} from "ckeditor5";
import type { ButtonView, Command, DropdownView, ListDropdownItemDefinition, Locale } from "ckeditor5";

import admonitionIcon from "../icons/admonition.svg?raw";
import AdmonitionEditing from "./admonition/admonition_editing.js";
import { openListAsMenu } from "./toolbar_group_menu.js";

const HEADING_ICONS: Record<string, string> = {
    heading1: IconHeading1,
    heading2: IconHeading2,
    heading3: IconHeading3,
    heading4: IconHeading4,
    heading5: IconHeading5,
    heading6: IconHeading6
};

/** A row of the `blockType` list: the command that makes a block of that type, and what it shows. */
interface BlockType {
    label: string;
    icon: string;
    command: string;
    /** The heading of the `heading` command. */
    value?: string;
}

/**
 * Registers variants of toolbar items for the narrow toolbar of a phone. When a host is configured,
 * `ToolbarGroupMenu` opens the lists of both as the host application's menu.
 *
 * - `blockType`: what Notion calls "Turn into". The paragraph, the headings of the `heading`
 *   configuration, the bulleted, numbered and to-do lists and the code block, which replace each
 *   other, and the block quote and the admonition, which wrap the block. One dropdown, whose
 *   button shows an icon of the current block rather than its name, which takes 8em.
 * - `fontSizeMenu`: the `fontSize` dropdown.
 * - `alignmentMenu`: the `alignment` dropdown, whose button shows the current alignment, with the
 *   alignments as a row of tiles.
 */
export default class MobileToolbarItems extends Plugin {

    static get requires() {
        return [Heading, List, TodoList, CodeBlock, BlockQuote, AdmonitionEditing, FontSize, Alignment] as const;
    }

    static get pluginName() {
        return "MobileToolbarItems" as const;
    }

    init() {
        const editor = this.editor;

        editor.ui.componentFactory.add("blockType", (locale) => this.createBlockTypeDropdown(locale));

        editor.ui.componentFactory.add("fontSizeMenu", () => {
            const dropdown = editor.ui.componentFactory.create("fontSize") as DropdownView;
            openListAsMenu(dropdown);
            return dropdown;
        });

        editor.ui.componentFactory.add("alignmentMenu", () => {
            const dropdown = editor.ui.componentFactory.create("alignment") as DropdownView;
            openListAsMenu(dropdown, { layout: "tiles" });
            return dropdown;
        });
    }

    private createBlockTypeDropdown(locale: Locale) {
        const editor = this.editor;
        const t = editor.t;
        const accessibleLabel = t("Block type");
        const command = (name: string) => editor.commands.get(name) as Command;

        const blocks: BlockType[] = getLocalizedHeadingOptions(editor).map((option) => (option.model === "paragraph"
            ? { label: option.title, icon: IconParagraph, command: "paragraph" }
            : { label: option.title, icon: HEADING_ICONS[option.model], command: "heading", value: option.model }));
        const lists: BlockType[] = [
            { label: t("Bulleted List"), icon: IconBulletedList, command: "bulletedList" },
            { label: t("Numbered List"), icon: IconNumberedList, command: "numberedList" },
            { label: t("To-do List"), icon: IconTodoList, command: "todoList" }
        ];
        const code: BlockType = { label: t("Code block"), icon: IconCodeBlock, command: "codeBlock" };
        const wrappers: BlockType[] = [
            { label: t("Block quote"), icon: IconQuote, command: "blockQuote" },
            { label: t("Admonition"), icon: admonitionIcon, command: "admonition" }
        ];
        const groups = [blocks, lists, [code, ...wrappers]];
        const commands = [...new Set(groups.flat().map((type) => type.command))].map(command);

        // A list item is a paragraph too, so the lists are asked first. A wrapper is not a type of
        // the block, which keeps its own.
        const current = () => lists.find((type) => command(type.command).value === true)
            ?? (command("codeBlock").value ? code : undefined)
            ?? blocks.find((type) => (type.value
                ? command("heading").value === type.value
                : command("paragraph").value === true));
        const isOn = (type: BlockType) => (wrappers.includes(type)
            ? Boolean(command(type.command).value)
            : current() === type);

        const items = new Collection<ListDropdownItemDefinition>();
        for (const [index, group] of groups.entries()) {
            if (index > 0) {
                items.add({ type: "separator" });
            }
            for (const type of group) {
                const model = new UIModel({
                    label: type.label, icon: type.icon, role: "menuitemradio", withText: true, blockType: type
                });
                model.bind("isOn").toMany(commands, "value", () => isOn(type));
                items.add({ type: "button", model });
            }
        }

        const dropdown = createDropdown(locale);
        addListToDropdown(dropdown, items, { ariaLabel: accessibleLabel, role: "menu" });
        dropdown.buttonView.set({ withText: false, tooltip: accessibleLabel });
        dropdown.buttonView.bind("icon").toMany(commands, "value", () => current()?.icon ?? IconParagraph);
        dropdown.buttonView.bind("label").toMany(commands, "value", () => current()?.label ?? accessibleLabel);
        dropdown.buttonView.bind("ariaLabel").toMany(commands, "value", () => {
            const type = current();
            return type ? `${type.label}, ${accessibleLabel}` : accessibleLabel;
        });
        dropdown.bind("isEnabled").toMany(commands, "isEnabled", (...enabled) => enabled.some(Boolean));

        dropdown.on("execute", (evt) => {
            const { blockType } = evt.source as ButtonView & { blockType: BlockType };
            this.setBlockType(blockType, { lists, code, wrappers });
        });
        openListAsMenu(dropdown, { layout: "tiles" });
        return dropdown;
    }

    /**
     * Turns the selected blocks into `type` as one undo step, as Notion's "Turn into" does: a list
     * is made of paragraphs, a paragraph, a heading or a code block picked in a list leaves the
     * list, and anything but a code block picked in one leaves it. A wrapper toggles around the
     * blocks instead.
     */
    private setBlockType(type: BlockType, { lists, code, wrappers }: {
        lists: BlockType[];
        code: BlockType;
        wrappers: BlockType[];
    }) {
        const editor = this.editor;
        const isOn = (name: string) => Boolean(editor.commands.get(name)?.value);

        editor.model.change(() => {
            if (wrappers.includes(type)) {
                editor.execute(type.command);
                return;
            }

            const currentList = lists.find((list) => isOn(list.command));
            if (isOn("codeBlock") && type !== code) {
                editor.execute("codeBlock", { forceValue: false });
            }
            if (lists.includes(type)) {
                if (!isOn("paragraph")) {
                    editor.execute("paragraph");
                }
                editor.execute(type.command, { forceValue: true });
                return;
            }

            if (currentList) {
                editor.execute(currentList.command, { forceValue: false });
            }
            if (type === code) {
                editor.execute(type.command, { forceValue: true });
            } else {
                editor.execute(type.command, type.value ? { value: type.value } : undefined);
            }
        });
        editor.editing.view.focus();
    }
}
