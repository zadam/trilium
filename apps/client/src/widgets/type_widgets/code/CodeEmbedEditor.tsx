import type VanillaCodeMirror from "@triliumnext/codemirror";
import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

import type FNote from "../../../entities/fnote";
import type { ContentEditor } from "../../../services/content_renderer";
import { CodeMirrorFindTarget } from "../../find_in_code";
import { useNoteLabelOptionalBool, useTriliumOptionBool } from "../../react/hooks";
import { registerEmbedFindTarget } from "../text/content_embed_tools";
import { CaretNavigationContext, useEmbedCaretNavigation } from "../text/editable_embed";
import { CodeEditor } from "./Code";

export interface CodeEmbedEditorProps {
    note: FNote | null;
    /** Saves the edits, or `undefined` to show the content read-only. */
    editor: ContentEditor | undefined;
    content: string;
    mime: string;
    /** The tab width, or `undefined` to follow the global option. */
    tabWidth: number | undefined;
    /** Whether to indent with tabs, or `undefined` to follow the global option. */
    useTabs: boolean | undefined;
    /** Whether to wrap the lines, over the `#wrapLines` label of `note` and the global option. */
    wrapLines?: boolean;
    /** Whether to show the line numbers. Shown by default. */
    hasLineNumbers?: boolean;
    /** Holds the CodeMirror view while the editor is open, and `null` once it goes away. */
    viewRef: RefObject<VanillaCodeMirror | null>;
    /** Whether the editor shows. "Search in note" skips a hidden one. Shown by default. */
    isShown?: boolean;
    /** Receives the edited content when the editor goes away. */
    onClose: (content: string) => void;
    /** Receives the content as it is edited. */
    onChange?: (content: string) => void;
    /** Called with CodeMirror once it mounts, for extensions such as a linter. */
    onReady?: (view: VanillaCodeMirror) => void;
}

/**
 * CodeMirror over the content of a code embed, which `editor` saves as it changes. Without an
 * `editor`, the content is read-only.
 */
export default function CodeEmbedEditor({
    note, editor, content, mime, tabWidth, useTabs, wrapLines, hasLineNumbers, viewRef,
    isShown = true, onClose, onChange, onReady
}: CodeEmbedEditorProps) {
    const isLoadingRef = useRef(false);
    const [ vimKeymapEnabled ] = useTriliumOptionBool("vimKeymapEnabled");
    const [ noteWrapLines ] = useNoteLabelOptionalBool(note, "wrapLines");
    const lineWrapping = wrapLines ?? noteWrapLines;
    useEmbedCaretNavigation(() => viewRef.current);

    // Runs after the effects of `CodeMirror`, which creates the view.
    useEffect(() => {
        const view = viewRef.current;
        if (view) {
            onReady?.(view);
        }
    }, []);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !isShown) return;

        const unregister = registerEmbedFindTarget(view.dom, new CodeMirrorFindTarget(view));
        return () => {
            unregister();
            // Clears the search matches of an editor that is hidden rather than unmounted.
            if (view.dom.isConnected) {
                view.cleanSearch();
            }
        };
    }, [ isShown ]);

    // Runs after the effects of `CodeMirror`, which empties the document as it mounts.
    useEffect(() => {
        const view = viewRef.current;
        if (!view || view.getText() === content) return;

        // Loading changes the document as well, which must not schedule a save.
        isLoadingRef.current = true;
        view.setText(content);
        isLoadingRef.current = false;
        view.clearHistory();
    }, [ content ]);

    // A layout cleanup runs during the unmount, before CodeMirror is destroyed.
    useLayoutEffect(() => () => {
        const text = viewRef.current?.getText();
        // `release()` reads the pending content through `viewRef`, so the ref clears after it.
        editor?.release();
        viewRef.current = null;
        if (editor && text !== undefined) {
            onClose(text);
        }
    }, [ editor, onClose ]);

    return (
        <CodeEditor
            ntxId={null}
            editorRef={viewRef}
            className="code-embed-editor"
            mime={mime}
            vimKeybindings={vimKeymapEnabled}
            readOnly={!editor}
            lineNumbers={hasLineNumbers}
            onContentChanged={() => {
                if (editor && !isLoadingRef.current) {
                    editor.scheduleSave(() => viewRef.current?.getText() ?? "");
                    onChange?.(viewRef.current?.getText() ?? "");
                }
            }}
            {...(tabWidth !== undefined && { indentSize: tabWidth })}
            {...(useTabs !== undefined && { useTabs })}
            {...(lineWrapping != null && { lineWrapping })}
        />
    );
}

export interface EmbedSourcePaneProps
    extends Omit<CodeEmbedEditorProps, "isShown" | "onClose" | "onChange"> {
    /** The root of the embed content, which the arrow keys enter the source from. */
    rootRef: RefObject<HTMLElement | null>;
    /** Whether the Editable toggle of the embed is on. */
    isEditing: boolean;
    /** Whether the display mode of the embed shows the source. */
    isSourceShown: boolean;
    /** Receives the content as it is edited, and when the editor goes away. */
    onContentChange: (content: string) => void;
}

/**
 * The source pane of an embed laid out by `SplitLayout`: a {@link CodeEmbedEditor} that edits the
 * source while `isEditing`, and shows it read-only otherwise.
 */
export function EmbedSourcePane({
    rootRef, editor, isEditing, isSourceShown, onContentChange, ...editorProps
}: EmbedSourcePaneProps) {
    return (
        <div className="note-detail-split-editor">
            {/* An edited source stays mounted while the rendering shows alone, which keeps its
                undo history. "Search in note" and the arrow keys skip it then. */}
            {(isEditing || isSourceShown) && (
                <CaretNavigationContext.Provider
                    value={isEditing && isSourceShown ? rootRef : null}
                >
                    <CodeEmbedEditor
                        key={isEditing ? "editing" : "read-only"}
                        editor={isEditing ? editor : undefined}
                        isShown={isSourceShown}
                        onClose={onContentChange}
                        onChange={onContentChange}
                        {...editorProps}
                    />
                </CaretNavigationContext.Provider>
            )}
        </div>
    );
}
