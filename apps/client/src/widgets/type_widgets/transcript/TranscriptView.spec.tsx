import type {
    Transcript, TranscriptionState, TranscriptSource, TranscriptUtterance
} from "@triliumnext/commons";
import { Tooltip } from "bootstrap";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

import Component from "../../../components/component";
import type FAttachment from "../../../entities/fattachment";
import LoadResults from "../../../services/load_results";
import { renderInto } from "../../../test/render";
import { ParentComponent } from "../../react/react_utils";
import TranscriptView, {
    formatOffset, groupIntoTurns, parseTranscript, type TranscriptTurn
} from "./TranscriptView";

vi.mock("../../../services/i18n", () => ({ t: (key: string) => key }));

/** Local time, so that the clock times the spec expects hold in every time zone. */
const STARTED_AT = "2026-10-13T14:29:55";

function transcript(utterances: TranscriptUtterance[], startedAt = STARTED_AT) {
    const content: Transcript = { version: 1, startedAt, utterances };
    return JSON.stringify(content);
}

function paragraphTexts(turn: TranscriptTurn) {
    return turn.paragraphs.map((paragraph) => paragraph.map(({ text }) => text).join(" "));
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
        const turns = groupIntoTurns([
            { source: "microphone", offsetMs: 1000, text: "Hello." },
            { source: "microphone", offsetMs: 3000, text: "Can you hear me?" },
            { source: "system", offsetMs: 5000, text: "Yes." },
            { source: "microphone", offsetMs: 7000, text: "Good." }
        ]);
        expect(turns.map(({ source, offsetMs }) => ({ source, offsetMs }))).toEqual([
            { source: "microphone", offsetMs: 1000 },
            { source: "system", offsetMs: 5000 },
            { source: "microphone", offsetMs: 7000 }
        ]);
        expect(turns.map(paragraphTexts)).toEqual([
            [ "Hello. Can you hear me?" ], [ "Yes." ], [ "Good." ]
        ]);
    });

    it("starts a turn when the speaker of a source changes, not for an unidentified one", () => {
        const turns = groupIntoTurns([
            { source: "system", offsetMs: 0, text: "Hi." },
            { source: "system", offsetMs: 1000, speaker: 1, text: "Welcome to the show." },
            { source: "system", offsetMs: 4000, text: "Yes." },
            { source: "system", offsetMs: 5000, speaker: 1, text: "Our guest is here." },
            { source: "system", offsetMs: 8000, speaker: 2, text: "Thanks for having me." }
        ]);
        expect(turns.map(({ speaker, offsetMs }) => ({ speaker, offsetMs }))).toEqual([
            { speaker: 1, offsetMs: 0 },
            { speaker: 2, offsetMs: 8000 }
        ]);
        expect(turns.map(paragraphTexts)).toEqual([
            [ "Hi. Welcome to the show. Yes. Our guest is here." ], [ "Thanks for having me." ]
        ]);
    });

    it("starts a new paragraph within a turn after a long pause", () => {
        const turns = groupIntoTurns([
            { source: "system", offsetMs: 0, durationMs: 8000, text: "First point," },
            { source: "system", offsetMs: 8100, durationMs: 3000, text: "continued." },
            { source: "system", offsetMs: 12_600, durationMs: 2000, text: "Short pause." },
            { source: "system", offsetMs: 17_000, durationMs: 2000, text: "Second point." }
        ]);
        expect(turns.map(paragraphTexts)).toEqual([
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
                { source: "system", offsetMs: 8000, speaker: 2, text: "Yes." }
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
            "transcript.speaker_me14:29Can you hear me?Hello?",
            "transcript.speaker_numbered14:30Yes."
        ]);
        expect(container.querySelectorAll(".transcript-microphone p")).toHaveLength(2);
    });

    it("fades in only the utterances that arrive after the transcript opens", async () => {
        const first: TranscriptUtterance = { source: "system", offsetMs: 0, text: "Hi." };
        const getBlob = vi.fn()
            .mockResolvedValueOnce({ content: transcript([ first ]) })
            .mockResolvedValueOnce({ content: transcript([
                first, { source: "system", offsetMs: 2000, text: "Anyone?" }
            ]) });
        const attachment = { attachmentId: "transcript1", getBlob } as unknown as FAttachment;
        const component = new Component();
        const container = renderInto(
            <ParentComponent.Provider value={component}>
                <TranscriptView attachment={attachment} />
            </ParentComponent.Provider>
        );
        await vi.waitFor(() => expect(container.textContent).toContain("Hi."));

        const loadResults = new LoadResults([]);
        loadResults.addAttachmentRow({ attachmentId: "transcript1", ownerId: "meeting" } as never);
        await act(async () => {
            await component.handleEvent("entitiesReloaded", { loadResults });
        });
        await vi.waitFor(() => expect(container.textContent).toContain("Anyone?"));

        const spans = [ ...container.querySelectorAll(".transcript-turn p span") ]
            .map((span) => [ span.textContent, span.classList.contains("transcript-new") ]);
        expect(spans).toEqual([ [ "Hi.", false ], [ " Anyone?", true ] ]);
    });

    it("times turns by the clock, with the offset as a tooltip or alone", async () => {
        const renderTimes = async (startedAt: string) => {
            const utterance: TranscriptUtterance =
                { source: "system", offsetMs: 65_000, text: "Yes." };
            const content = transcript([ utterance ], startedAt);
            const attachment = { attachmentId: "transcript1", getBlob: async () => ({ content }) };
            const container = renderInto(
                <ParentComponent.Provider value={new Component()}>
                    <TranscriptView attachment={attachment as unknown as FAttachment} />
                </ParentComponent.Provider>
            );
            await vi.waitFor(() =>
                expect(container.querySelector(".transcript-time")).not.toBeNull());
            return container.querySelector<HTMLElement>(".transcript-time");
        };

        const time = await renderTimes(STARTED_AT);
        expect(time?.textContent).toBe("14:31");
        expect(time?.getAttribute("datetime"))
            .toBe(new Date("2026-10-13T14:31:00").toISOString());
        const tooltip = time && Tooltip.getInstance(time);
        expect(tooltip).toBeTruthy();
        act(() => tooltip?.show());
        expect(document.querySelector(".tooltip")?.textContent).toBe("transcript.offset");
        act(() => tooltip?.dispose());

        const offset = await renderTimes("not a date");
        expect(offset?.textContent).toBe("1:05");
        expect(offset && Tooltip.getInstance(offset)).toBeNull();
    });

    it("shows who is speaking in the recorded meeting, before the words arrive", async () => {
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
            "transcript.speaker_me14:29Hello?transcript.speaking",
            "transcript.speaker_otherstranscript.speaking"
        ]));

        await recording("other", [ "system" ]);
        expect(turns()).toEqual([ "transcript.speaker_me14:29Hello?" ]);
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
