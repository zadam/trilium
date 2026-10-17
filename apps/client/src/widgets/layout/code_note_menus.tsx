import type VanillaCodeMirror from "@triliumnext/codemirror";
import { getCodeLanguageIcon } from "@triliumnext/commons";
import { createPortal } from "preact";
import { useMemo, useState } from "preact/hooks";

import type FNote from "../../entities/fnote";
import type { MenuItem } from "../../menus/context_menu";
import { t } from "../../services/i18n";
import server from "../../services/server";
import {
    useNoteLabelInt, useNoteLabelOptionalBool, useNoteProperty, useTriliumOptionBool,
    useTriliumOptionInt
} from "../react/hooks";
import { codeLanguageItems, NoteTypeOptionsModal, useMimeTypes } from "./NoteTypeSwitcher";
import { convertIndentation } from "./reindentation";

/** A menu of the settings of a code note, and what the control that opens it shows. */
export interface CodeNoteMenu {
    /** The name of the menu, shown as the tooltip of the control. */
    title: string;
    /** The current setting, shown as the text of the control. */
    text: string;
    /** The icon of the current setting. */
    icon: string;
    items: MenuItem<unknown>[];
    filterable?: boolean;
}

/** The text of a code editor, which the tab width menu re-indents. */
export type CodeText = Pick<VanillaCodeMirror, "getText" | "setText">;

/**
 * The "Change language mode" menu of `note`, and the dialog that its "Configure code notes" item
 * opens, which the caller renders.
 */
export function useCodeLanguageMenu(note: FNote | null | undefined) {
    const [ isModalShown, setIsModalShown ] = useState(false);
    const currentMime = useNoteProperty(note, "mime");
    const { enabledMimeTypes, allMimeTypes } = useMimeTypes();
    const mimeType = useMemo(() => (
        allMimeTypes.find((candidate) => candidate.mime === currentMime)
    ), [ allMimeTypes, currentMime ]);

    const menu: CodeNoteMenu = {
        title: t("status_bar.code_note_switcher"),
        text: mimeType?.title ?? "",
        icon: getCodeLanguageIcon(mimeType),
        items: codeLanguageItems({
            currentMimeType: currentMime,
            mimeTypes: enabledMimeTypes,
            changeNoteType: (type, mime) => {
                if (note) void server.put(`notes/${note.noteId}/type`, { type, mime });
            },
            onConfigure: () => setIsModalShown(true)
        }),
        filterable: true
    };
    const modal = createPortal(
        <NoteTypeOptionsModal modalShown={isModalShown} setModalShown={setIsModalShown} />,
        document.body
    );
    return { menu, modal };
}

const TAB_WIDTH_OPTIONS = [ 1, 2, 3, 4, 6, 8 ] as const;

/**
 * The "Change tab width" menu of `note`. Its re-indent items convert the text of
 * `getCodeEditor()`, and do nothing while it returns no editor.
 */
export function useTabWidthMenu(
    note: FNote | null | undefined,
    getCodeEditor: () => Promise<CodeText | null | undefined>
): CodeNoteMenu {
    const [ globalTabWidth ] = useTriliumOptionInt("codeNoteTabWidth");
    const [ globalUseTabs ] = useTriliumOptionBool("codeNoteIndentWithTabs");
    const [ noteTabWidth, setNoteTabWidth ] = useNoteLabelInt(note, "tabWidth");
    const [ noteUseTabs, setNoteUseTabs ] = useNoteLabelOptionalBool(note, "indentWithTabs");
    const effectiveTabWidth = noteTabWidth ?? globalTabWidth ?? 4;
    const effectiveUseTabs = noteUseTabs ?? globalUseTabs;

    const reindentTo = async (targetUseTabs: boolean, targetWidth: number) => {
        const editor = await getCodeEditor();
        if (!editor) return;
        const converted = convertIndentation(
            editor.getText(),
            { useTabs: effectiveUseTabs, width: effectiveTabWidth },
            { useTabs: targetUseTabs, width: targetWidth }
        );
        if (converted !== editor.getText()) {
            editor.setText(converted);
        }
        setNoteTabWidth(targetWidth);
        setNoteUseTabs(targetUseTabs);
    };

    const spacesName = t("status_bar.tab_width_style_spaces");
    const tabsName = t("status_bar.tab_width_style_tabs");
    const items: MenuItem<unknown>[] = [
        { kind: "header", title: t("status_bar.tab_width_style_header") },
        { title: spacesName, checked: !effectiveUseTabs, handler: () => setNoteUseTabs(false) },
        { title: tabsName, checked: effectiveUseTabs, handler: () => setNoteUseTabs(true) }
    ];
    if (noteUseTabs != null) {
        items.push({
            title: t("status_bar.tab_width_use_default_style", {
                style: globalUseTabs ? tabsName : spacesName
            }),
            uiIcon: "bx bx-x",
            handler: () => setNoteUseTabs(null)
        });
    }

    items.push({ kind: "header", title: t("status_bar.tab_width_display_header") });
    for (const size of TAB_WIDTH_OPTIONS) {
        items.push({
            title: t("status_bar.tab_width_spaces", { count: size }),
            checked: effectiveTabWidth === size,
            handler: () => setNoteTabWidth(size)
        });
    }
    if (noteTabWidth != null) {
        items.push({
            title: t("status_bar.tab_width_use_default", { width: globalTabWidth }),
            uiIcon: "bx bx-x",
            handler: () => setNoteTabWidth(null)
        });
    }

    items.push({ kind: "header", title: t("status_bar.tab_width_reindent_header") });
    for (const size of TAB_WIDTH_OPTIONS) {
        items.push({
            title: t("status_bar.tab_width_spaces", { count: size }),
            uiIcon: "bx bx-empty",
            enabled: effectiveUseTabs || effectiveTabWidth !== size,
            handler: () => void reindentTo(false, size)
        });
    }
    items.push({
        title: tabsName,
        uiIcon: "bx bx-empty",
        enabled: !effectiveUseTabs,
        handler: () => void reindentTo(true, effectiveTabWidth)
    });

    return {
        title: t("status_bar.tab_width_title"),
        text: effectiveUseTabs
            ? t("status_bar.tab_width_tabs", { width: effectiveTabWidth })
            : t("status_bar.tab_width_spaces_short", { width: effectiveTabWidth }),
        icon: "bx bx-right-indent",
        items
    };
}
