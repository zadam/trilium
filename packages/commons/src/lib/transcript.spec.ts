import { describe, expect, it } from "vitest";

import {
    getSpeakerKey, MAX_SPEAKER_NAME_LENGTH, parseTranscript, setSpeakerName, type Transcript
} from "./transcript.js";

const TRANSCRIPT: Transcript = {
    version: 1,
    startedAt: "2026-10-14T09:30:00.000Z",
    utterances: [ { source: "system", offsetMs: 0, speaker: 2, text: "Hi." } ]
};

describe("transcript", () => {
    it("reads only version 1 transcripts", () => {
        expect(parseTranscript(JSON.stringify(TRANSCRIPT))).toEqual(TRANSCRIPT);
        expect(parseTranscript(null)).toBeNull();
        expect(parseTranscript("")).toBeNull();
        expect(parseTranscript("not json")).toBeNull();
        expect(parseTranscript(JSON.stringify({ version: 2, utterances: [] }))).toBeNull();
        expect(parseTranscript(JSON.stringify({ version: 1 }))).toBeNull();
    });

    it("keys the local speaker and identified system speakers, not unidentified speech", () => {
        expect(getSpeakerKey("microphone")).toBe("microphone");
        expect(getSpeakerKey("microphone", 3)).toBe("microphone");
        expect(getSpeakerKey("system", 2)).toBe("system:2");
        expect(getSpeakerKey("system")).toBeNull();
    });

    it("names a speaker, trims and caps the name, and forgets it when blank", () => {
        const named = setSpeakerName(TRANSCRIPT, "system:2", "  Alexandra ");
        expect(named.speakers).toEqual({ "system:2": "Alexandra" });
        expect(named.utterances).toBe(TRANSCRIPT.utterances);
        expect(TRANSCRIPT.speakers).toBeUndefined();

        const both = setSpeakerName(named, "microphone", "x".repeat(MAX_SPEAKER_NAME_LENGTH + 5));
        expect(both.speakers?.microphone).toHaveLength(MAX_SPEAKER_NAME_LENGTH);
        expect(setSpeakerName(both, "system:2", " ").speakers).toEqual({
            microphone: "x".repeat(MAX_SPEAKER_NAME_LENGTH)
        });
    });
});
