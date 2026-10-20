import type { LineOperation, LineOperationOptions, TextTransform } from "@triliumnext/commons";

import type { CommandNames } from "../components/app_context.js";
import { t } from "../services/i18n.js";
import options from "../services/options.js";
import { resolveContentLanguage } from "../utils/formatters.js";
import type { MenuCommandItem, MenuItem } from "./context_menu.js";
import { submenuItem } from "./context_menu_utils.js";

/**
 * The text tools of a code editor's right-click menu, which change the selected lines or text:
 * the _Line operations_, _Line removal_ and _Text transform_ submenus. Their rows are disabled
 * while nothing is selected.
 *
 * Returns `null` when `element` is not in an editable code editor.
 */
export async function buildCodeEditorContextMenuItems(
    element: Element | null | undefined
): Promise<MenuItem<CommandNames>[] | null> {
    const root = element?.closest(".cm-editor");
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    // Imported here: the menu is set up at startup, and a code editor loads CodeMirror later.
    const {
        default: CodeMirror, hasSelectedText, runLineOperation, runTextTransform
    } = await import("@triliumnext/codemirror");
    const editor = CodeMirror.findFromDOM(root);
    if (!(editor instanceof CodeMirror) || editor.state.readOnly) {
        return null;
    }

    const isEnabled = hasSelectedText(editor.state);
    const toolOptions = getTextToolOptions();
    const lineItem = (
        title: string, uiIcon: string, operation: LineOperation, tooltip?: string
    ): MenuCommandItem<CommandNames> => ({
        title,
        uiIcon,
        tooltip,
        enabled: isEnabled,
        handler: () => {
            runLineOperation(editor, operation, toolOptions);
            editor.focus();
        }
    });
    const transformItem = (
        title: string, uiIcon: string, transform: TextTransform
    ): MenuCommandItem<CommandNames> => ({
        title,
        uiIcon,
        enabled: isEnabled,
        handler: () => {
            runTextTransform(editor, transform, toolOptions);
            editor.focus();
        }
    });

    const lineOperations: MenuItem<CommandNames>[] = [
        lineItem(t("code_editor_context_menu.sort_ascending"), "bx bx-sort-a-z", "sortAscending"),
        lineItem(t("code_editor_context_menu.sort_descending"), "bx bx-sort-z-a", "sortDescending"),
        { kind: "separator" },
        lineItem(t("code_editor_context_menu.shuffle_lines"), "bx bx-shuffle", "shuffle"),
        lineItem(t("code_editor_context_menu.reverse_lines"), "bx bx-transfer-alt bx-rotate-90",
            "reverse"),
        lineItem(t("code_editor_context_menu.deduplicate_lines"), "bx bx-layer-minus",
            "deduplicate")
    ];
    const lineRemoval: MenuItem<CommandNames>[] = [
        lineItem(t("code_editor_context_menu.trim_leading"), "bx bx-align-left", "trimLeading",
            t("code_editor_context_menu.trim_leading_tooltip")),
        lineItem(t("code_editor_context_menu.trim_trailing"), "bx bx-align-right", "trimTrailing",
            t("code_editor_context_menu.trim_trailing_tooltip")),
        lineItem(t("code_editor_context_menu.trim_both"), "bx bx-align-middle", "trimBoth",
            t("code_editor_context_menu.trim_both_tooltip")),
        { kind: "separator" },
        lineItem(t("code_editor_context_menu.remove_blank_lines"), "bx bx-collapse-vertical",
            "removeBlankLines")
    ];
    const textTransforms: MenuItem<CommandNames>[] = [
        transformItem(t("code_editor_context_menu.to_uppercase"), "bx bx-chevrons-up", "upperCase"),
        transformItem(t("code_editor_context_menu.to_lowercase"), "bx bx-chevrons-down",
            "lowerCase"),
        transformItem(t("code_editor_context_menu.to_sentence_case"), "bx bx-text",
            "sentenceCase"),
        transformItem(t("code_editor_context_menu.to_title_case"), "bx bx-heading", "titleCase"),
        { kind: "separator" },
        transformItem(t("code_editor_context_menu.remove_diacritics"), "bx bx-eraser",
            "removeDiacritics")
    ];

    return [
        submenuItem({
            title: t("code_editor_context_menu.line_operations"),
            uiIcon: "bx bx-list-ul"
        }, lineOperations),
        submenuItem({
            title: t("code_editor_context_menu.line_removal"),
            uiIcon: "bx bx-list-minus"
        }, lineRemoval),
        submenuItem({
            title: t("code_editor_context_menu.text_transform"),
            uiIcon: "bx bx-font"
        }, textTransforms)
    ];
}

/** The locale of the note content, and the user's own date format for sorting by date. */
function getTextToolOptions(): LineOperationOptions {
    const customDateTimeFormat = options.get("customDateTimeFormat");
    return {
        locale: resolveContentLanguage(null) ?? undefined,
        dateFormats: customDateTimeFormat ? [ customDateTimeFormat ] : []
    };
}
