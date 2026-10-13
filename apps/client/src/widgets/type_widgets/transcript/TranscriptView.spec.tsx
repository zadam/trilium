import type { Transcript, TranscriptUtterance } from "@triliumnext/commons";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

import Component from "../../../components/component";
import type FAttachment from "../../../entities/fattachment";
import LoadResults from "../../../services/load_results";
import { renderInto } from "../../../test/render";
import { ParentComponent } from "../../react/react_utils";
import TranscriptView, { formatOffset, groupIntoTurns, parseTranscript } from "./TranscriptView";

vi.mock("../../../services/i18n", () => ({ t: (key: string) => key }));

function transcript(utterances: TranscriptUtterance[]) {
    const content: Transcript = { version: 1, startedAt: "2026-10-13T14:30:00.000Z", utterances };
    return JSON.stringify(content);
}

describe("transcript helpers", () => {
    it("reads only version 1 transcripts", () => {
        expect(parseTranscript(transcript([]))?.utterances).toEqual([]);
        expect(parseTranscript(null)).toBeNull();
        expect(parseTranscript("not json")).toBeNull();
        expect(parseTranscript(JSON.stringify({ version: 2, utterances: [] }))).toBeNull();
        expect(parseTranscript(JSON.stringify({ version: 1 }))).toBeNull();
    });

    it("joins consecutive utterances of one source into a turn timed by its first", () => {
        expect(groupIntoTurns([
            { source: "microphone", offsetMs: 1000, text: "Hello." },
            { source: "microphone", offsetMs: 3000, text: "Can you hear me?" },
            { source: "system", offsetMs: 5000, text: "Yes." },
            { source: "microphone", offsetMs: 7000, text: "Good." }
        ])).toEqual([
            { source: "microphone", offsetMs: 1000, text: "Hello. Can you hear me?" },
            { source: "system", offsetMs: 5000, text: "Yes." },
            { source: "microphone", offsetMs: 7000, text: "Good." }
        ]);
    });

    it("formats offsets as m:ss, with hours once there are any", () => {
        expect(formatOffset(0)).toBe("0:00");
        expect(formatOffset(65_900)).toBe("1:05");
        expect(formatOffset(3_725_000)).toBe("1:02:05");
        expect(formatOffset(-5)).toBe("0:00");
    });
});

describe("TranscriptView", () => {
    it("shows the turns, and the new content once the recording rewrites it", async () => {
        const getBlob = vi.fn()
            .mockResolvedValueOnce({ content: transcript([]) })
            .mockResolvedValueOnce({ content: transcript([
                { source: "microphone", offsetMs: 1500, text: "Can you hear me?" },
                { source: "system", offsetMs: 3000, text: "Yes." }
            ]) });
        const attachment = { attachmentId: "transcript1", getBlob } as unknown as FAttachment;
        const component = new Component();

        const container = renderInto(
            <ParentComponent.Provider value={component}>
                <TranscriptView attachment={attachment} />
            </ParentComponent.Provider>
        );
        await vi.waitFor(() => expect(container.textContent).toContain("transcript.empty"));

        const loadResults = new LoadResults([]);
        loadResults.addAttachmentRow({ attachmentId: "transcript1", ownerId: "meeting" } as never);
        await act(async () => {
            await component.handleEvent("entitiesReloaded", { loadResults });
        });

        const turns = () => [ ...container.querySelectorAll(".transcript-turn") ]
            .map((turn) => turn.textContent);
        await vi.waitFor(() => expect(turns()).toHaveLength(2));
        expect(turns()).toEqual([
            "transcript.speaker_me0:01Can you hear me?",
            "transcript.speaker_others0:03Yes."
        ]);
    });
});
