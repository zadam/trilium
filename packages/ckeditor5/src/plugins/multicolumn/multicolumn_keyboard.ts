import { type Editor, env, Plugin } from "ckeditor5";

import { addEditingKeydownCapture } from "../move_block_updown.js";
import { type ColumnTarget, getSelectedColumn } from "./multicolumn_commands.js";
import MulticolumnEditing from "./multicolumn_editing.js";

/**
 * Keyboard shortcuts of multicolumn layouts. Ctrl+Left/Right and Ctrl+Shift+Home/End move the
 * selected content to another column, Ctrl+Alt+Left/Right/Home/End move the current column, and
 * Ctrl+Enter and Ctrl+Shift+Enter add a column after or before it. Ctrl is Cmd on macOS.
 */
export default class MulticolumnKeyboard extends Plugin {

    public static get pluginName() {
        return "MulticolumnKeyboard" as const;
    }

    public static get requires() {
        return [MulticolumnEditing] as const;
    }

    public init(): void {
        const editor = this.editor;
        const t = editor.t;

        // The capture phase runs before `TodoListEditing`, which stops every Ctrl+Enter.
        addEditingKeydownCapture(this, event => {
            const isRtl = editor.locale.contentLanguageDirection === "rtl";
            const shortcut = getShortcut(event, isRtl);
            if (!shortcut || !appliesAtSelection(editor, shortcut)) {
                return;
            }

            // At the first or last column, or with four columns, the key does nothing.
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!editor.commands.get(shortcut.command)?.isEnabled) {
                return;
            }
            if (shortcut.command === "insertLayoutColumn") {
                editor.execute(shortcut.command, { position: shortcut.position });
            } else {
                editor.execute(shortcut.command, { target: shortcut.target });
            }
        });

        editor.accessibility.addKeystrokeInfoGroup({
            id: "multicolumnLayout",
            label: t("Keystrokes that can be used in a multicolumn layout"),
            keystrokes: [
                {
                    label: t("Move the selected content to the column on the left"),
                    keystroke: "Ctrl+ArrowLeft"
                },
                {
                    label: t("Move the selected content to the column on the right"),
                    keystroke: "Ctrl+ArrowRight"
                },
                {
                    label: t("Move the selected content to the first column"),
                    keystroke: "Ctrl+Shift+Home"
                },
                {
                    label: t("Move the selected content to the last column"),
                    keystroke: "Ctrl+Shift+End"
                },
                { label: t("Move the column to the left"), keystroke: "Ctrl+Alt+ArrowLeft" },
                { label: t("Move the column to the right"), keystroke: "Ctrl+Alt+ArrowRight" },
                { label: t("Make the column the first one"), keystroke: "Ctrl+Alt+Home" },
                { label: t("Make the column the last one"), keystroke: "Ctrl+Alt+End" },
                { label: t("Add a column after the current one"), keystroke: "Ctrl+Enter" },
                { label: t("Add a column before the current one"), keystroke: "Ctrl+Shift+Enter" }
            ]
        });
    }

}

type Shortcut =
    | { command: "moveToLayoutColumn" | "moveLayoutColumn"; target: ColumnTarget }
    | { command: "insertLayoutColumn"; position: "before" | "after" };

/**
 * Returns the shortcut that `event` presses. Left and Right follow the screen, so in right-to-left
 * content Right moves toward the first column.
 */
function getShortcut(event: KeyboardEvent, isRtl: boolean): Shortcut | null {
    const { altKey: alt, shiftKey: shift } = event;
    const ctrl = env.isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if (!ctrl) {
        return null;
    }

    const command = alt ? "moveLayoutColumn" : "moveToLayoutColumn";
    switch (event.key) {
        case "ArrowLeft":
        case "ArrowRight": {
            const target = (event.key === "ArrowRight") !== isRtl ? "next" : "previous";
            return shift ? null : { command, target };
        }
        case "Home":
        case "End": {
            const target = event.key === "Home" ? "first" : "last";
            return alt === shift ? null : { command, target };
        }
        case "Enter":
            return alt
                ? null
                : { command: "insertLayoutColumn", position: shift ? "before" : "after" };
        default:
            return null;
    }
}

/**
 * Whether `shortcut` acts on the selection in a column. A caret keeps Ctrl+Left/Right and
 * Ctrl+Shift+Home/End for moving and selecting by word and to the edges. Ctrl+Enter stays with
 * links, to-do items and collapsible titles, and Ctrl+Shift+Enter with to-do items.
 */
function appliesAtSelection(editor: Editor, shortcut: Shortcut) {
    const selection = editor.model.document.selection;
    if (!getSelectedColumn(editor)) {
        return false;
    }

    switch (shortcut.command) {
        case "moveToLayoutColumn":
            return !selection.isCollapsed;
        case "moveLayoutColumn":
            return true;
        case "insertLayoutColumn":
            if (shortcut.position === "before") {
                return !editor.commands.get("setTaskState")?.isEnabled;
            }
            return !editor.commands.get("checkTodoList")?.isEnabled
                && !selection.hasAttribute("linkHref")
                && !selection.getSelectedElement()?.is("element", "reference")
                && !selection.getFirstPosition()?.findAncestor("summary");
    }
}
