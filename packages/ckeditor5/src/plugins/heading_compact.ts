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
import type { DropdownView, HeadingCommand, ParagraphCommand } from "ckeditor5";

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
            return dropdown;
        });
    }
}
