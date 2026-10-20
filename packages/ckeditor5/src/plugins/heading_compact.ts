import {
    Heading,
    IconHeading1,
    IconHeading2,
    IconHeading3,
    IconHeading4,
    IconHeading5,
    IconHeading6,
    IconParagraph,
    Plugin
} from "ckeditor5";
import type {
    ButtonView, DropdownView, HeadingCommand, ListItemView, ListView, ParagraphCommand
} from "ckeditor5";

import { openListAsMenu } from "./toolbar_group_menu.js";

const HEADING_ICONS: Record<string, string> = {
    heading1: IconHeading1,
    heading2: IconHeading2,
    heading3: IconHeading3,
    heading4: IconHeading4,
    heading5: IconHeading5,
    heading6: IconHeading6
};

/**
 * Registers `headingCompact`, the `heading` dropdown with an icon of the current block in place of
 * its name, for a toolbar too narrow for the name's 8em. The name stays in the accessible label.
 * Each row of its list carries the icon of its block, and `ToolbarGroupMenu` opens the list as
 * the host application's menu when a host is configured.
 */
export default class HeadingCompactUI extends Plugin {

    static get requires() {
        return [Heading] as const;
    }

    static get pluginName() {
        return "HeadingCompactUI" as const;
    }

    init() {
        const editor = this.editor;

        editor.ui.componentFactory.add("headingCompact", () => {
            const dropdown = editor.ui.componentFactory.create("heading") as DropdownView;
            const headingCommand = editor.commands.get("heading") as HeadingCommand;
            const paragraphCommand = editor.commands.get("paragraph") as ParagraphCommand;

            dropdown.buttonView.withText = false;
            dropdown.buttonView.bind("icon").to(
                headingCommand, "value", paragraphCommand, "value",
                (heading, paragraph) => (paragraph ? IconParagraph : HEADING_ICONS[heading || ""] ?? IconParagraph)
            );

            // CKEditor builds the list as the dropdown first opens, at the highest priority.
            dropdown.once("change:isOpen", () => {
                for (const item of (dropdown.listView as ListView).items) {
                    const row = (item as ListItemView).children.first as HeadingRow;
                    row.icon = HEADING_ICONS[row.commandValue ?? ""] ?? IconParagraph;
                }
            });
            openListAsMenu(dropdown);
            return dropdown;
        });
    }
}

/** A row of the `heading` list, which `HeadingUI` binds to the command it runs. */
type HeadingRow = ButtonView & { commandName?: string; commandValue?: string };
