import "./CodeEmbed.css";

import type VanillaCodeMirror from "@triliumnext/codemirror";
import { createPortal, type RefObject } from "preact";
import { lazy, useSyncExternalStore } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import FNote from "../../../entities/fnote";
import { type ContentEditor, renderCodePreview } from "../../../services/content_renderer";
import {
    type CodeText, useCodeLanguageMenu, useTabWidthMenu
} from "../../layout/code_note_menus";
import { SaveStateBadge } from "../../layout/NoteBadges";
import { useNoteBlob, useNoteProperty, useTriliumEvent } from "../../react/hooks";
import { useContentEmbedMenus } from "../text/content_embed_menus";
import {
    EditableEmbedContent, useEditableEmbed, useEmbedBadgeSlot, useEmbedPreview
} from "../text/editable_embed";

const CodeEmbedEditor = lazy(() => import("./CodeEmbedEditor"));

interface CodeEmbedProps {
    entity: FNote | FAttachment;
    /** Saves the changes to `entity`. */
    editor: ContentEditor;
    /** The content shown first. */
    content: string;
    /** The MIME type that highlights the content. A note follows its own `mime` instead. */
    mime: string;
    /** The highlighted `content`. */
    preview: HTMLElement;
}

/**
 * A code note or a code file in an embed, shown highlighted, and edited with CodeMirror while the
 * Editable toggle of its embed is on.
 */
export default function CodeEmbed({
    entity, editor, content: initialContent, mime: initialMime, preview
}: CodeEmbedProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<VanillaCodeMirror>(null);
    const note = entity instanceof FNote ? entity : null;
    // The toolbar buttons of a note come from `CodeNoteTools`, with the Editable toggle.
    const { canEdit, isEditing } = useEditableEmbed(rootRef, {
        editor, note, tools: note ? null : undefined, focusTarget: ".cm-content"
    });
    const [ content, setContent ] = useState(initialContent);
    const mime = useNoteProperty(note, "mime") ?? initialMime;
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
                    viewRef={viewRef}
                    onClose={setContent}
                />
            </EditableEmbedContent>
            <SaveStatus rootRef={rootRef} editor={editor} isShown={isEditing} />
            {canEdit && note && (
                <CodeNoteTools rootRef={rootRef} note={note} getCodeText={getCodeText} />
            )}
        </>
    );
}

interface CodeNoteToolsProps {
    rootRef: RefObject<HTMLElement | null>;
    note: FNote;
    /** The text that the re-indent items of the tab width menu convert. */
    getCodeText: () => CodeText;
}

/**
 * The "Change language mode" and "Change tab width" menus of the status bar, as buttons of the
 * toolbar of the embed around `rootRef`.
 */
function CodeNoteTools({ rootRef, note, getCodeText }: CodeNoteToolsProps) {
    const language = useCodeLanguageMenu(note);
    const tabWidth = useTabWidthMenu(note, async () => getCodeText());
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
