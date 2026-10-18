import type { InlineEmbedSource } from "@triliumnext/ckeditor5";
import type { ComponentType } from "preact";
import { useSyncExternalStore } from "preact/compat";
import { useEffect, useMemo, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import type FNote from "../../../entities/fnote";
import type { ContentEditor } from "../../../services/content_renderer";
import type { InlineSourceSaves } from "./attachment_saves";
import type { SourceEmbedProps } from "../../../services/source_embeds";
import { useSavedContent } from "../code/CodeEmbed";

interface AttachmentSourceEmbedProps {
    entity: FNote | FAttachment;
    editor: ContentEditor | undefined;
    /** The source shown first. */
    content: string;
    component: ComponentType<SourceEmbedProps>;
}

/** The component of a source embed type, over a source kept in a note or an attachment. */
export default function AttachmentSourceEmbed({
    entity, editor, content: initialContent, component: Component
}: AttachmentSourceEmbedProps) {
    const [ content, setContent ] = useState(initialContent);
    useSavedContent(entity, editor, setContent);

    return <Component content={content} editor={editor} />;
}

interface InlineSourceEmbedProps {
    source: InlineEmbedSource;
    component: ComponentType<SourceEmbedProps>;
    /** The writes that the text note saves first. */
    saves?: InlineSourceSaves;
}

/** The component of a source embed type, over a source kept inline in the text note. */
export function InlineSourceEmbed({ source, component: Component, saves }: InlineSourceEmbedProps) {
    const content = useSyncExternalStore(source.subscribe, source.getSource);
    const editor = useMemo(() => createInlineSourceEditor(source, saves), [ source, saves ]);
    useEffect(() => () => editor.release(), [ editor ]);

    return <Component content={content} editor={editor} />;
}

/**
 * The editor of a source kept inline, which writes the source into the text note a moment after
 * it stops changing, each write one step of the text editor's undo. Until then `saves` holds the
 * write, so that the text note makes it before it saves.
 */
export function createInlineSourceEditor(
    source: InlineEmbedSource,
    saves?: InlineSourceSaves
): ContentEditor {
    let getPending: (() => string) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
        clearTimeout(timeout);
        timeout = undefined;
        saves?.delete(flush);
        const getContent = getPending;
        getPending = undefined;
        if (getContent) {
            source.setSource(getContent());
        }
    };

    return {
        canEdit: () => !source.isReadOnly(),
        getUnsavedContent: () => getPending?.(),
        scheduleSave(getContent, onSaved) {
            getPending = getContent;
            saves?.add(flush);
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                flush();
                onSaved?.(source.getSource());
            }, INLINE_SAVE_DELAY);
        },
        release: flush
    };
}

/** How long an inline source has to stay unchanged before it is written, in milliseconds. */
const INLINE_SAVE_DELAY = 500;
