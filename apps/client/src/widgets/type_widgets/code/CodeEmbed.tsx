import "./CodeEmbed.css";

import type { ContentEmbedCodeView } from "@triliumnext/ckeditor5";
import type VanillaCodeMirror from "@triliumnext/codemirror";
import { createPortal, type RefObject } from "preact";
import { lazy, useSyncExternalStore } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import FNote from "../../../entities/fnote";
import { type ContentEditor, renderCodePreview } from "../../../services/content_renderer";
import {
    type CodeSettings, type CodeText, useCodeLanguageMenu, useNoteCodeSettings, useTabWidthMenu
} from "../../layout/code_menus";
import { SaveStateBadge } from "../../layout/NoteBadges";
import { useNoteBlob, useTriliumEvent } from "../../react/hooks";
import { useContentEmbedMenus } from "../text/content_embed_menus";
import { useContentEmbedAttribute } from "../text/content_embed_tools";
import {
    EditableEmbedContent, findTextEditorAround, useEditableEmbed, useEmbedBadgeSlot,
    useEmbedPreview
} from "../text/editable_embed";

const CodeEmbedEditor = lazy(() => import("./CodeEmbedEditor"));

interface CodeEmbedProps {
    entity: FNote | FAttachment;
    /** Saves the changes to `entity`. */
    editor: ContentEditor;
    /** The content shown first. */
    content: string;
    /**
     * The MIME type that highlights the content: the language of a note, or that of the name of
     * a file. A note follows its own `mime` as it changes.
     */
    mime: string;
    /** The language that the embed of a file sets, as a MIME type, in place of `mime`. */
    codeLanguage?: string;
    /** The highlighted `content`. */
    preview: HTMLElement;
}

/**
 * A code note or a code file in an embed, shown highlighted, and edited with CodeMirror while the
 * Editable toggle of its embed is on.
 */
export default function CodeEmbed({
    entity, editor, content: initialContent, mime: initialMime, codeLanguage, preview
}: CodeEmbedProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<VanillaCodeMirror>(null);
    const note = entity instanceof FNote ? entity : null;
    // The toolbar buttons come from `CodeTools`, with the Editable toggle.
    const { canEdit, isEditing } = useEditableEmbed(rootRef, {
        editor, note, tools: null, focusTarget: ".cm-content"
    });
    const noteSettings = useNoteCodeSettings(note);
    const fileSettings = useFileCodeSettings(rootRef, initialMime, codeLanguage);
    const settings = note ? noteSettings : fileSettings;
    const [ content, setContent ] = useState(initialContent);
    const mime = settings.mime ?? initialMime;
    useSavedContent(entity, editor, setContent);
    const shownPreview = useEmbedPreview(
        preview,
        `${mime}\n${content}`,
        () => renderCodePreview(content, mime),
        isEditing
    );
    // The editor while it is open, otherwise the content, which a change saves.
    const getCodeText = (): CodeText => viewRef.current ?? {
        getText: () => content,
        setText: (text) => {
            editor.scheduleSave(() => text);
            setContent(text);
        }
    };

    return (
        <>
            <EditableEmbedContent
                rootRef={rootRef}
                className="code-embed-content"
                isEditing={isEditing}
                hasCaretNavigation
                preview={shownPreview}
            >
                <CodeEmbedEditor
                    note={note}
                    editor={editor}
                    content={content}
                    mime={mime}
                    tabWidth={settings.tabWidth}
                    useTabs={settings.useTabs}
                    viewRef={viewRef}
                    onClose={setContent}
                />
            </EditableEmbedContent>
            <SaveStatus rootRef={rootRef} editor={editor} isShown={isEditing} />
            {canEdit && (
                <CodeTools rootRef={rootRef} settings={settings} getCodeText={getCodeText} />
            )}
        </>
    );
}

/**
 * The code settings of a file, which its embed keeps in `data-code-*` attributes: a language that
 * replaces `fileMime`, the language of its name, and the indentation. `initialLanguage` is the
 * language until the content is in the embed.
 */
function useFileCodeSettings(
    rootRef: RefObject<HTMLElement | null>,
    fileMime: string,
    initialLanguage: string | undefined
): CodeSettings {
    const language = useContentEmbedAttribute(rootRef, "data-code-language", initialLanguage ?? null);
    const tabWidth = useContentEmbedAttribute(rootRef, "data-code-tab-width");
    const useTabs = useContentEmbedAttribute(rootRef, "data-code-indent-with-tabs");

    return {
        mime: language ?? fileMime,
        setMime: (mime) => {
            setCodeView(rootRef.current, { language: mime === fileMime ? null : mime });
        },
        tabWidth: tabWidth ? parseInt(tabWidth, 10) || undefined : undefined,
        useTabs: useTabs === null ? undefined : useTabs === "true",
        setIndentation: (indentation) => setCodeView(rootRef.current, {
            tabWidth: indentation.tabWidth,
            indentWithTabs: indentation.useTabs
        })
    };
}

/** Sets how the embed around `root` shows its code, through the text editor that holds it. */
function setCodeView(root: HTMLElement | null, codeView: ContentEmbedCodeView) {
    const editor = findTextEditorAround(root);
    if (!root || !editor?.plugins.get("ContentEmbed").selectEmbedAt(root)) return;

    editor.execute("setContentEmbedCodeView", codeView);
}

interface CodeToolsProps {
    rootRef: RefObject<HTMLElement | null>;
    settings: CodeSettings;
    /** The text that the re-indent items of the tab width menu convert. */
    getCodeText: () => CodeText;
}

/**
 * The "Change language mode" and "Change tab width" menus of the status bar, as buttons of the
 * toolbar of the embed around `rootRef`.
 */
function CodeTools({ rootRef, settings, getCodeText }: CodeToolsProps) {
    const language = useCodeLanguageMenu(settings);
    const tabWidth = useTabWidthMenu(settings, async () => getCodeText());
    useContentEmbedMenus(rootRef, [
        { id: "codeLanguage", ...language.menu },
        { id: "tabWidth", ...tabWidth }
    ]);

    return language.modal;
}

interface SaveStatusProps {
    rootRef: RefObject<HTMLElement | null>;
    editor: ContentEditor;
    isShown: boolean;
}

/**
 * The save state of `editor` in the title row of the embed around `rootRef`, while `isShown`, for
 * content that saves on its own.
 */
function SaveStatus({ rootRef, editor, isShown }: SaveStatusProps) {
    const slot = useEmbedBadgeSlot(rootRef, isShown);
    const state = useSyncExternalStore(
        editor.subscribeSaveState ?? subscribeToNothing,
        () => editor.getSaveState?.()
    );

    return slot && createPortal(<SaveStateBadge state={state} />, slot);
}

/**
 * Shows the content of `entity` each time it saves, also when another embed of it saved it.
 * Unsaved changes made in the embed are kept, and replace that content when they save.
 */
function useSavedContent(
    entity: FNote | FAttachment,
    editor: ContentEditor,
    setContent: (content: string) => void
) {
    const noteBlob = useNoteBlob(entity instanceof FNote ? entity : null);
    const [ attachmentContent, setAttachmentContent ] = useState<string>();
    const requestIdRef = useRef(0);
    const content = entity instanceof FNote ? noteBlob?.content : attachmentContent;

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (entity instanceof FNote) return;
        const rows = loadResults.getAttachmentRows();
        if (rows.some((row) => row.attachmentId === entity.attachmentId)) {
            const requestId = ++requestIdRef.current;
            void entity.getBlob().then((blob) => {
                if (requestId === requestIdRef.current) {
                    setAttachmentContent(blob?.content);
                }
            });
        }
    });

    useEffect(() => {
        if (content !== undefined && editor.getUnsavedContent() === undefined) {
            setContent(content);
        }
    }, [ content ]);
}

function subscribeToNothing() {
    return () => {};
}
