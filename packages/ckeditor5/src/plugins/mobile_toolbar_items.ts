import {
    _getLocalizedHeadingOptions as getLocalizedHeadingOptions,
    addListToDropdown,
    Collection,
    createDropdown,
    FontSize,
    Heading,
    IconBulletedList,
    IconHeading1,
    IconHeading2,
    IconHeading3,
    IconHeading4,
    IconHeading5,
    IconHeading6,
    IconNumberedList,
    IconParagraph,
    IconTodoList,
    List,
    Plugin,
    TodoList,
    UIModel
} from "ckeditor5";
import type { ButtonView, Command, DropdownView, ListDropdownItemDefinition, Locale } from "ckeditor5";

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
 *   configuration, and the bulleted, numbered and to-do lists, as one dropdown whose button shows
 *   an icon of the current block rather than its name, which takes 8em.
 * - `fontSizeMenu`: the `fontSize` dropdown.
 */
export default class MobileToolbarItems extends Plugin {

    static get requires() {
        return [Heading, List, TodoList, FontSize] as const;
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
        const commands = [...new Set([...blocks, ...lists].map((type) => type.command))].map(command);

        // A list item is a paragraph too, so the lists are asked first.
        const current = () => lists.find((type) => command(type.command).value === true)
            ?? blocks.find((type) => (type.value
                ? command("heading").value === type.value
                : command("paragraph").value === true));

        const items = new Collection<ListDropdownItemDefinition>();
        for (const [index, type] of [...blocks, ...lists].entries()) {
            if (index === blocks.length) {
                items.add({ type: "separator" });
            }
            const model = new UIModel({
                label: type.label, icon: type.icon, role: "menuitemradio", withText: true, blockType: type
            });
            model.bind("isOn").toMany(commands, "value", () => current() === type);
            items.add({ type: "button", model });
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
            this.setBlockType(blockType, lists.find((type) => command(type.command).value === true));
        });
        openListAsMenu(dropdown);
        return dropdown;
    }

    /**
     * Turns the selected blocks into `type` as one undo step. A list is made of paragraphs, and a
     * paragraph or a heading picked in a list leaves the list, as Notion's "Turn into" does.
     */
    private setBlockType(type: BlockType, currentList: BlockType | undefined) {
        const editor = this.editor;

        editor.model.change(() => {
            if (type.command.endsWith("List")) {
                if (editor.commands.get("paragraph")?.value !== true) {
                    editor.execute("paragraph");
                }
                editor.execute(type.command, { forceValue: true });
            } else {
                if (currentList) {
                    editor.execute(currentList.command, { forceValue: false });
                }
                editor.execute(type.command, type.value ? { value: type.value } : undefined);
            }
        });
        editor.editing.view.focus();
    }
}
