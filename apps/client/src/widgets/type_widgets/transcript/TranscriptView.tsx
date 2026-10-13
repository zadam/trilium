import "./TranscriptView.css";

import type { Transcript, TranscriptSource, TranscriptUtterance } from "@triliumnext/commons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import { t } from "../../../services/i18n";
import { useTriliumEvent } from "../../react/hooks";
import NoItems from "../../react/NoItems";

/** How close to the end, in pixels, still counts as reading the newest turn. */
const FOLLOW_THRESHOLD = 16;

/** How long a pause within one speaker's turn starts a new paragraph. */
const PARAGRAPH_PAUSE_MS = 2000;

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
                    {turn.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </div>
            ))}
        </div>
    );
}

/** Consecutive utterances from one source, split into paragraphs at long pauses. */
export interface TranscriptTurn {
    source: TranscriptSource;
    offsetMs: number;
    paragraphs: string[];
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

/**
 * Joins each run of utterances from one source into a turn, timed by its first utterance, and
 * starts a new paragraph after a pause of {@link PARAGRAPH_PAUSE_MS} or more. An utterance without
 * a `durationMs` never starts one, since the pause before the next is unknown.
 */
export function groupIntoTurns(utterances: TranscriptUtterance[]): TranscriptTurn[] {
    const turns: TranscriptTurn[] = [];
    let previousEndMs: number | null = null;
    for (const { source, offsetMs, durationMs, text } of utterances) {
        const last = turns.at(-1);
        if (last?.source !== source) {
            turns.push({ source, offsetMs, paragraphs: [ text ] });
        } else if (previousEndMs !== null && offsetMs - previousEndMs >= PARAGRAPH_PAUSE_MS) {
            last.paragraphs.push(text);
        } else {
            last.paragraphs[last.paragraphs.length - 1] += ` ${text}`;
        }
        previousEndMs = durationMs === undefined ? null : offsetMs + durationMs;
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
