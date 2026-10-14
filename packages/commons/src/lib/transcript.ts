/**
 * Where an utterance was heard: the local speaker's microphone, or everyone else on the system
 * output.
 */
export type TranscriptSource = "microphone" | "system";

/** One transcribed stretch of speech. */
export interface TranscriptUtterance {
    source: TranscriptSource;
    /** Milliseconds from the start of the recording to the start of the utterance. */
    offsetMs: number;
    /** Length of the utterance in milliseconds. Absent from transcripts recorded before it was kept. */
    durationMs?: number;
    /**
     * Who spoke, numbered from 1 within the source in the order the speakers were first heard.
     * Absent when the speaker could not be told, and on the microphone.
     */
    speaker?: number;
    text: string;
}

/**
 * The content of a `transcript` attachment: a meeting recording as it is transcribed. The recording
 * rewrites it after every utterance.
 */
export interface Transcript {
    version: 1;
    /** When the recording started, as an ISO 8601 timestamp; the offsets count from here. */
    startedAt: string;
    /**
     * Names given to speakers, by {@link getSpeakerKey}. A speaker without one keeps its default
     * name.
     */
    speakers?: Record<string, string>;
    utterances: TranscriptUtterance[];
}

export const TRANSCRIPT_MIME = "application/json";

/** The longest speaker name a transcript accepts. */
export const MAX_SPEAKER_NAME_LENGTH = 100;

/** Reads a transcript attachment's content, or returns `null` for content of another shape. */
export function parseTranscript(content: string | null | undefined): Transcript | null {
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
 * The key a speaker's name is stored under: `microphone` for the local speaker, `system:<n>` for
 * an identified speaker of the system output, and `null` for system speech no speaker was found
 * for, which can be anyone.
 */
export function getSpeakerKey(source: TranscriptSource, speaker?: number) {
    if (source === "microphone") {
        return "microphone";
    }
    return speaker === undefined ? null : `system:${speaker}`;
}

/**
 * Names the speaker of `key`, or gives back its default name when `name` is blank. Returns a new
 * transcript; the utterances are shared.
 */
export function setSpeakerName(transcript: Transcript, key: string, name: string): Transcript {
    const speakers = { ...transcript.speakers };
    delete speakers[key];
    const trimmed = name.trim().slice(0, MAX_SPEAKER_NAME_LENGTH);
    if (trimmed) {
        speakers[key] = trimmed;
    }
    return { ...transcript, speakers };
}
