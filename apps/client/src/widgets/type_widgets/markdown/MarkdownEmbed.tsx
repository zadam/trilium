import "./MarkdownEmbed.css";

import type VanillaCodeMirror from "@triliumnext/codemirror";
import clsx from "clsx";
import type { RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import FNote from "../../../entities/fnote";
import type { ContentEditor } from "../../../services/content_renderer";
import { isDesktop } from "../../../services/utils";
import { useNoteCodeSettings } from "../../layout/code_menus";
import { useDebouncedValue } from "../../react/hooks";
import { SaveStatus, useSavedContent } from "../code/CodeEmbed";
import CodeEmbedEditor from "../code/CodeEmbedEditor";
import { resolveDisplayMode } from "../helpers/split_editor_mode";
import { SplitLayout, useMountedPanes } from "../helpers/SplitEditor";
import { registerContentEmbedTools, useContentEmbedDisplayMode } from "../text/content_embed_tools";
import {
    CaretNavigationContext, EmbedPreview, useEditableEmbed, useEmbedPreview
} from "../text/editable_embed";
import {
    renderWithSourceLines, useMarkdownKeymap, useNoteLinkChips, useSyncedHighlight,
    useSyncedScrolling
} from "./Markdown";

interface MarkdownEmbedProps {
    entity: FNote | FAttachment;
    /** Saves the changes to `entity`, or `undefined` where the content is read-only. */
    editor: ContentEditor | undefined;
    /** The Markdown shown first. */
    content: string;
    /** The rendering of `content`. */
    preview: HTMLElement;
    /** Renders Markdown as `preview` shows it. */
    renderPreview: (content: string) => Promise<HTMLElement>;
}

/**
 * A Markdown note or file in an embed, laid out as the split editor of a Markdown note: its source
 * in CodeMirror, its rendering, or both side by side, as the display mode of the embed picks. The
 * source can be edited while the Editable toggle of the embed is on.
 */
export default function MarkdownEmbed({
    entity, editor, content: initialContent, preview, renderPreview
}: MarkdownEmbedProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<VanillaCodeMirror>(null);
    const [ view, setView ] = useState<VanillaCodeMirror | null>(null);
    const note = entity instanceof FNote ? entity : null;
    const { canEdit, isEditing } = useEditableEmbed(rootRef, {
        editor, note, tools: null, focusTarget: ".cm-content"
    });
    useDisplayModeTools(rootRef, canEdit);
    const mode = resolveDisplayMode(useContentEmbedDisplayMode(rootRef), !isEditing);
    const isSourceShown = mode !== "preview";
    const { editorMounted, previewMounted } = useMountedPanes(mode);
    const { tabWidth, useTabs } = useNoteCodeSettings(note);

    const [ content, setContent ] = useState(initialContent);
    useSavedContent(entity, editor, setContent);
    const renderedContent = useDebouncedValue(content, PREVIEW_DELAY);
    const shownPreview = useEmbedPreview(
        preview, renderedContent, () => renderPreview(renderedContent)
    );

    const shownView = isSourceShown ? view : null;
    const previewElement = shownPreview instanceof HTMLDivElement ? shownPreview : null;
    useSyncedScrolling(shownView, previewElement);
    useSyncedHighlight(shownView, previewElement, renderedContent);
    useNoteLinkChips(shownView);
    useMarkdownKeymap(isEditing ? shownView : null);
    const caretNavigationRoot = isEditing && isSourceShown ? rootRef : null;

    return (
        <div
            ref={rootRef}
            className={clsx("markdown-embed-content", isSourceShown && "with-source")}
        >
            <SplitLayout
                mode={mode}
                orientation={isDesktop() ? "horizontal" : "vertical"}
                editor={(
                    <div className="note-detail-split-editor">
                        {/* An edited source stays mounted while the preview shows alone, which
                            keeps its undo history. "Search in note" and the arrow keys skip it
                            then. */}
                        {(isEditing || isSourceShown) && (
                            <CaretNavigationContext.Provider value={caretNavigationRoot}>
                                <CodeEmbedEditor
                                    key={isEditing ? "editing" : "read-only"}
                                    note={note}
                                    editor={isEditing ? editor : undefined}
                                    content={content}
                                    mime={MARKDOWN_MIME}
                                    tabWidth={tabWidth}
                                    useTabs={useTabs}
                                    viewRef={viewRef}
                                    isShown={isSourceShown}
                                    onClose={setContent}
                                    onChange={setContent}
                                    onReady={setView}
                                />
                            </CaretNavigationContext.Provider>
                        )}
                    </div>
                )}
                isEditorMounted={editorMounted.current}
                isPreviewMounted={previewMounted.current}
                previewContent={<EmbedPreview element={shownPreview} />}
            />
            {editor && <SaveStatus rootRef={rootRef} editor={editor} isShown={isEditing} />}
        </div>
    );
}

/** The HTML of the Markdown `source`, as the preview of a Markdown note renders it. */
export function renderMarkdownHtml(source: string) {
    return renderWithSourceLines(source).html;
}

/**
 * Offers the display modes of the content in `rootRef` on its embed, and the Editable toggle while
 * `canEdit`.
 */
function useDisplayModeTools(rootRef: RefObject<HTMLElement | null>, canEdit: boolean) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        return registerContentEmbedTools(root, {
            hasEditableFlag: canEdit,
            hasDisplayModes: true,
            getTools: () => [],
            execute: () => {},
            subscribe: () => () => {}
        });
    }, [ rootRef, canEdit ]);
}

/** The language of the source pane. */
const MARKDOWN_MIME = "text/x-markdown";
/** How long the source has to stay unchanged before the preview renders again, in milliseconds. */
const PREVIEW_DELAY = 300;
