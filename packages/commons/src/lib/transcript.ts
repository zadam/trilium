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
    utterances: TranscriptUtterance[];
}

export const TRANSCRIPT_MIME = "application/json";
