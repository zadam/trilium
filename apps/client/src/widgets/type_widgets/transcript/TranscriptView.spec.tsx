import type {
    Transcript, TranscriptionState, TranscriptSource, TranscriptUtterance
} from "@triliumnext/commons";
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
            { source: "microphone", offsetMs: 1000, paragraphs: [ "Hello. Can you hear me?" ] },
            { source: "system", offsetMs: 5000, paragraphs: [ "Yes." ] },
            { source: "microphone", offsetMs: 7000, paragraphs: [ "Good." ] }
        ]);
    });

    it("starts a new paragraph within a turn after a long pause", () => {
        const turns = groupIntoTurns([
            { source: "system", offsetMs: 0, durationMs: 8000, text: "First point," },
            { source: "system", offsetMs: 8100, durationMs: 3000, text: "continued." },
            { source: "system", offsetMs: 12_600, durationMs: 2000, text: "Short pause." },
            { source: "system", offsetMs: 17_000, durationMs: 2000, text: "Second point." }
        ]);
        expect(turns.map((turn) => turn.paragraphs)).toEqual([
            [ "First point, continued. Short pause.", "Second point." ]
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
                { source: "microphone", offsetMs: 1500, durationMs: 1000, text: "Can you hear me?" },
                { source: "microphone", offsetMs: 6000, durationMs: 1000, text: "Hello?" },
                { source: "system", offsetMs: 8000, text: "Yes." }
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
            "transcript.speaker_me0:01Can you hear me?Hello?",
            "transcript.speaker_others0:08Yes."
        ]);
        expect(container.querySelectorAll(".transcript-microphone p")).toHaveLength(2);
    });

    it("shows who is speaking in the meeting its note records, before the words arrive", async () => {
        let onStateChanged: (state: TranscriptionState) => void = () => {};
        const recording = (noteId: string, pendingSources: TranscriptSource[]) =>
            act(() => onStateChanged({ status: "recording", noteId, pendingSources }));
        window.electronApi = {
            transcription: {
                getState: async () => ({
                    status: "recording", noteId: "meeting", pendingSources: []
                }),
                onStateChanged: (callback: typeof onStateChanged) => {
                    onStateChanged = callback;
                    return () => {};
                }
            }
        } as unknown as typeof window.electronApi;
        const getBlob = vi.fn()
            .mockResolvedValueOnce({ content: transcript([]) })
            .mockResolvedValueOnce({ content: transcript([
                { source: "microphone", offsetMs: 1500, durationMs: 1000, text: "Hello?" }
            ]) });
        const attachment = { attachmentId: "transcript1", ownerId: "meeting", getBlob };
        const component = new Component();
        const container = renderInto(
            <ParentComponent.Provider value={component}>
                <TranscriptView attachment={attachment as unknown as FAttachment} />
            </ParentComponent.Provider>
        );
        const turns = () => [ ...container.querySelectorAll(".transcript-turn") ]
            .map((turn) => turn.textContent);
        await vi.waitFor(() => expect(container.textContent).toContain("transcript.empty"));

        await recording("meeting", [ "system" ]);
        expect(turns()).toEqual([ "transcript.speaker_otherstranscript.speaking" ]);

        const loadResults = new LoadResults([]);
        loadResults.addAttachmentRow({ attachmentId: "transcript1", ownerId: "meeting" } as never);
        await act(async () => {
            await component.handleEvent("entitiesReloaded", { loadResults });
        });
        await recording("meeting", [ "microphone", "system" ]);
        await vi.waitFor(() => expect(turns()).toEqual([
            "transcript.speaker_me0:01Hello?transcript.speaking",
            "transcript.speaker_otherstranscript.speaking"
        ]));

        await recording("other", [ "system" ]);
        expect(turns()).toEqual([ "transcript.speaker_me0:01Hello?" ]);
        window.electronApi = undefined;
    });

    it("follows new turns for a reader at the end, not for one who scrolled up", async () => {
        const utterance = (index: number): TranscriptUtterance =>
            ({ source: "microphone", offsetMs: index * 60_000, text: `Line ${index}` });
        // Each reload adds a turn, alternating sources so that none merge.
        let count = 1;
        const getBlob = vi.fn(async () => ({
            content: transcript(Array.from({ length: count }, (_, index) => ({
                ...utterance(index), source: index % 2 ? "system" : "microphone"
            })))
        }));
        const attachment = { attachmentId: "transcript1", getBlob } as unknown as FAttachment;
        const component = new Component();
        const container = renderInto(
            <ParentComponent.Provider value={component}>
                <TranscriptView attachment={attachment} />
            </ParentComponent.Provider>
        );
        await vi.waitFor(() => expect(container.querySelector(".transcript")).not.toBeNull());

        // happy-dom lays nothing out: 100px of view over 50px a turn.
        const scroller = container.querySelector<HTMLElement>(".transcript");
        if (!scroller) {
            throw new Error("no scroller");
        }
        Object.defineProperty(scroller, "clientHeight", { value: 100 });
        Object.defineProperty(scroller, "scrollHeight", {
            get: () => scroller.querySelectorAll(".transcript-turn").length * 50
        });
        const addTurn = async () => {
            count++;
            const loadResults = new LoadResults([]);
            const row = { attachmentId: "transcript1", ownerId: "meeting" };
            loadResults.addAttachmentRow(row as never);
            await act(async () => {
                await component.handleEvent("entitiesReloaded", { loadResults });
            });
            await vi.waitFor(() =>
                expect(scroller.querySelectorAll(".transcript-turn")).toHaveLength(count));
        };

        await addTurn();
        await addTurn();
        expect(scroller.scrollTop).toBe(150);

        scroller.scrollTop = 0;
        await addTurn();
        expect(scroller.scrollTop).toBe(0);
    });
});
