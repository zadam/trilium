import type VanillaCodeMirror from "@triliumnext/codemirror";
import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

import type FNote from "../../../entities/fnote";
import type { ContentEditor } from "../../../services/content_renderer";
import { CodeMirrorFindTarget } from "../../find_in_code";
import { useNoteLabelOptionalBool, useTriliumOptionBool } from "../../react/hooks";
import { registerEmbedFindTarget } from "../text/content_embed_tools";
import { useEmbedCaretNavigation } from "../text/editable_embed";
import { CodeEditor } from "./Code";

export interface CodeEmbedEditorProps {
    note: FNote | null;
    editor: ContentEditor;
    content: string;
    mime: string;
    /** The tab width, or `undefined` to follow the global option. */
    tabWidth: number | undefined;
    /** Whether to indent with tabs, or `undefined` to follow the global option. */
    useTabs: boolean | undefined;
    /** Holds the CodeMirror view while the editor is open, and `null` once it goes away. */
    viewRef: RefObject<VanillaCodeMirror | null>;
    /** Receives the edited content when the editor goes away. */
    onClose: (content: string) => void;
}

/** CodeMirror over the content of a code embed, which `editor` saves as it changes. */
export default function CodeEmbedEditor({
    note, editor, content, mime, tabWidth, useTabs, viewRef, onClose
}: CodeEmbedEditorProps) {
    const isLoadingRef = useRef(false);
    const [ vimKeymapEnabled ] = useTriliumOptionBool("vimKeymapEnabled");
    const [ noteWrapLines ] = useNoteLabelOptionalBool(note, "wrapLines");
    useEmbedCaretNavigation(() => viewRef.current);

    // Runs after the effects of `CodeMirror`, which creates the view.
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        return registerEmbedFindTarget(view.dom, new CodeMirrorFindTarget(view));
    }, []);

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
        viewRef.current = null;
        editor.release();
        if (text !== undefined) {
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
            onContentChanged={() => {
                if (!isLoadingRef.current) {
                    editor.scheduleSave(() => viewRef.current?.getText() ?? "");
                }
            }}
            {...(tabWidth !== undefined && { indentSize: tabWidth })}
            {...(useTabs !== undefined && { useTabs })}
            {...(noteWrapLines != null && { lineWrapping: noteWrapLines })}
        />
    );
}
