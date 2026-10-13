import "./TranscriptView.css";

import type { Transcript, TranscriptSource, TranscriptUtterance } from "@triliumnext/commons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import { t } from "../../../services/i18n";
import { useTriliumEvent } from "../../react/hooks";
import NoItems from "../../react/NoItems";

/** How close to the end, in pixels, still counts as reading the newest turn. */
const FOLLOW_THRESHOLD = 16;

/**
 * Shows a `transcript` attachment as the conversation it records, one paragraph per speaker turn.
 * Follows the attachment as a running recording rewrites it, and keeps a reader who is at the end
 * there as new turns arrive.
 */
export default function TranscriptView({ attachment }: { attachment: FAttachment }) {
    const [ content, setContent ] = useState<string | null>();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const followRef = useRef(false);

    const load = useCallback(() => {
        let current = true;
        void attachment.getBlob().then((blob) => {
            if (current) {
                followRef.current = isScrolledToEnd(scrollerRef.current);
                setContent(blob?.content ?? null);
            }
        });
        return () => {
            current = false;
        };
    }, [ attachment ]);
    useEffect(load, [ load ]);
    useLayoutEffect(() => {
        const scroller = scrollerRef.current;
        if (followRef.current && scroller) {
            scroller.scrollTop = scroller.scrollHeight;
        }
    }, [ content ]);
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        const { attachmentId } = attachment;
        if (loadResults.getAttachmentRows().some((row) => row.attachmentId === attachmentId)) {
            load();
        }
    });

    if (content === undefined) {
        return null;
    }

    const transcript = parseTranscript(content);
    if (!transcript) {
        return <NoItems icon="bx bx-error" text={t("transcript.unreadable")} />;
    }
    if (!transcript.utterances.length) {
        return <NoItems icon="bx bx-microphone" text={t("transcript.empty")} />;
    }

    return (
        <div ref={scrollerRef} className="transcript">
            {groupIntoTurns(transcript.utterances).map((turn) => (
                <div key={turn.offsetMs} className={`transcript-turn transcript-${turn.source}`}>
                    <div className="transcript-turn-header">
                        <span className="transcript-speaker">{speakerName(turn.source)}</span>
                        <span className="transcript-time">{formatOffset(turn.offsetMs)}</span>
                    </div>
                    <p>{turn.text}</p>
                </div>
            ))}
        </div>
    );
}

/** Consecutive utterances from one source, read as one paragraph. */
export interface TranscriptTurn {
    source: TranscriptSource;
    offsetMs: number;
    text: string;
}

/** Reads a transcript attachment's content, or returns `null` for content of another shape. */
export function parseTranscript(content: string | null): Transcript | null {
    if (!content) {
        return null;
    }

    try {
        const parsed = JSON.parse(content) as Partial<Transcript>;
        const isTranscript = parsed.version === 1 && Array.isArray(parsed.utterances);
        return isTranscript ? parsed as Transcript : null;
    } catch {
        return null;
    }
}

/** Joins each run of utterances from one source into a turn, timed by its first utterance. */
export function groupIntoTurns(utterances: TranscriptUtterance[]): TranscriptTurn[] {
    const turns: TranscriptTurn[] = [];
    for (const { source, offsetMs, text } of utterances) {
        const last = turns.at(-1);
        if (last?.source === source) {
            last.text += ` ${text}`;
        } else {
            turns.push({ source, offsetMs, text });
        }
    }
    return turns;
}

/** `m:ss`, or `h:mm:ss` from the first hour on. */
export function formatOffset(milliseconds: number) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return hours
        ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
        : `${minutes}:${seconds}`;
}

function isScrolledToEnd(scroller: HTMLElement | null) {
    if (!scroller) {
        return false;
    }
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= FOLLOW_THRESHOLD;
}

function speakerName(source: TranscriptSource) {
    return source === "microphone" ? t("transcript.speaker_me") : t("transcript.speaker_others");
}
