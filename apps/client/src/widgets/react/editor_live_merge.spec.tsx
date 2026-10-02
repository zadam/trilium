import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mergeText } from "../../collab/live_merge";
import Component from "../../components/component";
import FBlob from "../../entities/fblob";
import type FNote from "../../entities/fnote";
import type LoadResults from "../../services/load_results";
import server from "../../services/server";
import type SpacedUpdate from "../../services/spaced_update";
import { buildNote } from "../../test/easy-froca";
import { type SavedData, useEditorSpacedUpdate } from "./hooks";
import { ParentComponent } from "./react_utils";

vi.stubGlobal("logError", vi.fn());
vi.stubGlobal("logInfo", vi.fn());

let spacedUpdate: SpacedUpdate<SavedData | undefined> | undefined;

/** A stand-in for an editor whose note guests edit too; `editor.content` is what it shows. */
function LiveEditor({ note, editor, onContentChange }: {
    note: FNote;
    editor: { content: string };
    onContentChange: (content: string) => void;
}) {
    spacedUpdate = useEditorSpacedUpdate({
        note,
        noteContext: null,
        noteType: "text",
        getData: () => ({ content: editor.content }),
        onContentChange,
        mergeRemoteContent(base, theirs) {
            const merged = mergeText(base, editor.content, theirs);

            if (merged !== null) {
                editor.content = merged;
            }

            return merged !== null;
        }
    });
    return null;
}

function blob(blobId: string, content: string) {
    return new FBlob({
        blobId, content, contentLength: content.length,
        dateModified: new Date().toISOString(), utcDateModified: new Date().toISOString()
    });
}

async function mount(content: string, putReplies: unknown[] = []) {
    const note = buildNote({ title: "Shared", type: "text", content });
    note.getBlob = vi.fn(async () => blob("blob-0", content));
    const editor = { content: "" };
    const onContentChange = vi.fn((loaded: string) => {
        editor.content = loaded;
    });
    const puts: Record<string, unknown>[] = [];
    server.put = vi.fn(async (_url: string, data: Record<string, unknown>) => {
        puts.push(data);
        return putReplies.shift() ?? { blobId: `blob-saved-${puts.length}` };
    }) as typeof server.put;
    const parent = new Component();
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
        render(<ParentComponent.Provider value={parent}>
            <LiveEditor note={note} editor={editor} onContentChange={onContentChange} />
        </ParentComponent.Provider>, container);
    });
    await vi.advanceTimersByTimeAsync(20);

    const type = (next: string) => {
        editor.content = next;
        spacedUpdate?.scheduleUpdate();
    };
    const receive = async (next: FBlob) => {
        note.getBlob = vi.fn(async () => next);
        const loadResults = {
            getEntityRow: () => undefined,
            isNoteContentReloaded: (noteId: string) => noteId === note.noteId
        } as unknown as LoadResults;
        await act(async () => {
            await parent.handleEvent("entitiesReloaded", { loadResults });
        });
        await vi.advanceTimersByTimeAsync(0);
    };

    return { editor, onContentChange, puts, type, receive, container };
}

describe("useEditorSpacedUpdate while guests edit the note", () => {
    let container: HTMLElement | undefined;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        if (container) {
            render(null, container);
            container.remove();
            container = undefined;
        }
        vi.useRealTimers();
    });

    it("merges another person's version in place, keeping unsaved edits for the next save",
        async () => {
            const harness = await mount("one two");
            container = harness.container;
            harness.type("one two three");

            await harness.receive(blob("blob-1", "zero one two"));

            expect(harness.editor.content).toBe("zero one two three");
            // Only the first load replaced the content.
            expect(harness.onContentChange).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(250);
            expect(harness.puts).toEqual([
                { content: "zero one two three", baseBlobId: "blob-1" }
            ]);
        });

    it("saves four times a second, and merges a version saved meanwhile into the save it missed",
        async () => {
            const harness = await mount("one two", [
                { stale: { blobId: "blob-2", content: "one two!" } }
            ]);
            container = harness.container;
            harness.type("zero one two");

            expect(harness.puts).toEqual([]);
            await vi.advanceTimersByTimeAsync(250);

            expect(harness.editor.content).toBe("zero one two!");
            // The merged content goes out at once, over the version it missed.
            expect(harness.puts).toEqual([
                { content: "zero one two", baseBlobId: "blob-0" },
                { content: "zero one two!", baseBlobId: "blob-2" }
            ]);
        });
});
