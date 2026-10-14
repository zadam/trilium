import "./TranscriptView.css";

import type { Transcript, TranscriptSource, TranscriptUtterance } from "@triliumnext/commons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import type FAttachment from "../../../entities/fattachment";
import { t } from "../../../services/i18n";
import utils from "../../../services/utils";
import { useTranscriptionState } from "../../launch_bar/RecordMeetingButton";
import { useStaticTooltip, useTriliumEvent } from "../../react/hooks";
import NoItems from "../../react/NoItems";

/** How close to the end, in pixels, still counts as reading the newest turn. */
const FOLLOW_THRESHOLD = 16;

/** How long a pause within one speaker's turn starts a new paragraph. */
const PARAGRAPH_PAUSE_MS = 2000;

/**
 * Shows a `transcript` attachment as the conversation it records, one paragraph per speaker turn.
 * Follows the attachment as a running recording rewrites it, shows which speakers the recording
 * hears before their words are transcribed, and keeps a reader who is at the end there as new
 * turns arrive.
 */
export default function TranscriptView({ attachment }: { attachment: FAttachment }) {
    const [ content, setContent ] = useState<string | null>();
    const recording = useTranscriptionState();
    const pending = recording.noteId === attachment.ownerId ? recording.pendingSources : [];
    const scrollerRef = useRef<HTMLDivElement>(null);
    /** The scroll height at the previous render, or `null` before the transcript first shows. */
    const scrollHeightRef = useRef<number | null>(null);

    const load = useCallback(() => {
        let current = true;
        void attachment.getBlob().then((blob) => {
            if (current) {
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
        if (!scroller) {
            return;
        }
        const previousHeight = scrollHeightRef.current;
        if (previousHeight !== null && wasAtEnd(scroller, previousHeight)) {
            scroller.scrollTop = scroller.scrollHeight;
        }
        scrollHeightRef.current = scroller.scrollHeight;
    });
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
    if (!transcript.utterances.length && !pending.length) {
        return <NoItems icon="bx bx-microphone" text={t("transcript.empty")} />;
    }

    const turns = groupIntoTurns(transcript.utterances);
    const lastTurn = turns.at(-1);
    const speaking = (
        <p className="transcript-speaking">
            <span className="bx bx-user-voice" aria-hidden="true" />
            {t("transcript.speaking")}
        </p>
    );
    return (
        <div ref={scrollerRef} className="transcript">
            {turns.map((turn) => (
                <div key={turn.offsetMs} className={`transcript-turn transcript-${turn.source}`}>
                    <div className="transcript-turn-header">
                        <span className="transcript-speaker">{speakerName(turn.source)}</span>
                        <TurnTime startedAt={transcript.startedAt} offsetMs={turn.offsetMs} />
                    </div>
                    {turn.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    {turn === lastTurn && pending.includes(turn.source) && speaking}
                </div>
            ))}
            {pending.filter((source) => source !== lastTurn?.source).map((source) => (
                <div key={`pending-${source}`} className={`transcript-turn transcript-${source}`}>
                    <div className="transcript-turn-header">
                        <span className="transcript-speaker">{speakerName(source)}</span>
                    </div>
                    {speaking}
                </div>
            ))}
        </div>
    );
}

/**
 * When a turn began, in local clock time, with its offset into the recording as the tooltip. Shows
 * the offset alone when the transcript's `startedAt` cannot be read.
 */
function TurnTime({ startedAt, offsetMs }: { startedAt: string; offsetMs: number }) {
    const timeRef = useRef<HTMLTimeElement>(null);
    const offset = formatOffset(offsetMs);
    const startedAtMs = Date.parse(startedAt);
    const time = Number.isNaN(startedAtMs) ? null : new Date(startedAtMs + offsetMs);
    const tooltip = time ? t("transcript.offset", { offset }) : "";
    const tooltipConfig = useMemo(() => ({ title: tooltip }), [ tooltip ]);
    useStaticTooltip(timeRef, tooltipConfig);

    if (!time) {
        return <span className="transcript-time">{offset}</span>;
    }
    return (
        <time ref={timeRef} className="transcript-time" dateTime={time.toISOString()}>
            {utils.formatTime(time)}
        </time>
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

/** Whether `scroller` showed the end of its content when that content was `scrollHeight` tall. */
function wasAtEnd(scroller: HTMLElement, scrollHeight: number) {
    return scrollHeight - scroller.scrollTop - scroller.clientHeight <= FOLLOW_THRESHOLD;
}

function speakerName(source: TranscriptSource) {
    return source === "microphone" ? t("transcript.speaker_me") : t("transcript.speaker_others");
}
