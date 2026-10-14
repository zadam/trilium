import "./PinnedAttachments.css";

import type { ComponentType } from "preact";

import type FAttachment from "../../entities/fattachment";
import type FNote from "../../entities/fnote";
import Collapsible from "../react/Collapsible";
import { useAttachments } from "../react/hooks";
import TranscriptView from "../type_widgets/transcript/TranscriptView";

/** The attachment roles shown at the top of their note, each with the view that renders it. */
const PINNED_ROLE_VIEWS: Record<string, ComponentType<{ attachment: FAttachment }>> = {
    transcript: TranscriptView
};

/** Shows the note's attachments of a pinned role above its content, one section each. */
export default function PinnedAttachments({ note }: { note: FNote }) {
    const attachments = useAttachments(note);

    return (
        <>
            {attachments.map((attachment) => {
                const View = Object.hasOwn(PINNED_ROLE_VIEWS, attachment.role)
                    ? PINNED_ROLE_VIEWS[attachment.role]
                    : null;
                return View && (
                    <Collapsible
                        key={attachment.attachmentId}
                        className="pinned-attachment"
                        title={attachment.title}
                        initiallyExpanded
                    >
                        <View attachment={attachment} />
                    </Collapsible>
                );
            })}
        </>
    );
}
