import type { RefObject } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../../components/component";
import type FNote from "../../entities/fnote";
import type { Suggestion } from "../../services/note_autocomplete";
import { buildNote } from "../../test/easy-froca";
import { renderInto } from "../../test/render";
import type { NoteAutocompleteHandle } from "../react/NoteAutocomplete";
import { ParentComponent } from "../react/react_utils";
import ContentEmbedDialog from "./content_embed";

const autocomplete = vi.hoisted(() => ({
    onChange: undefined as ((suggestion: Suggestion | null) => void) | undefined,
    clear: vi.fn()
}));

vi.mock("../../services/i18n", () => ({ t: (key: string) => key }));
vi.mock("../react/NoteAutocomplete", () => ({
    default: ({ onChange, handleRef }: {
        onChange: (suggestion: Suggestion | null) => void;
        handleRef: RefObject<Partial<NoteAutocompleteHandle>>;
    }) => {
        autocomplete.onChange = onChange;
        handleRef.current = { clear: autocomplete.clear };
        return <input />;
    }
}));

describe("ContentEmbedDialog", () => {
    let host: Component;
    let container: HTMLElement;
    const editorApi = { addContentEmbed: vi.fn(), addImage: vi.fn() };

    beforeEach(async () => {
        vi.clearAllMocks();
        host = new Component();
        container = renderInto(
            <ParentComponent.Provider value={host}>
                <ContentEmbedDialog />
            </ParentComponent.Provider>
        );
        await open();
    });

    async function open() {
        await act(async () => {
            void host.handleEventInChildren("showContentEmbedDialog", { editorApi });
        });
    }

    async function pick(note: FNote) {
        await act(async () => {
            autocomplete.onChange?.({ notePath: `root/${note.noteId}` });
        });
    }

    function sizeSelect() {
        const select = container.querySelector<HTMLSelectElement>(".include-note-size select");
        if (!select) throw new Error("The dialog has no box size select.");
        return select;
    }

    // happy-dom does not follow which option Preact marks as selected, so the size is read from the
    // description of the row, which names the chosen one.
    function checkedSize() {
        const description = container
            .querySelector(".include-note-size .tn-card-option-description")?.textContent;
        return /^include_note\.size_(\w+)_description$/.exec(description ?? "")?.[1];
    }

    async function choose(size: string) {
        const select = sizeSelect();
        await act(async () => {
            select.value = size;
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    async function submit() {
        const form = container.querySelector("form");
        if (!form) throw new Error("The dialog has no form.");
        await act(async () => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
    }

    it("lays out the note and the box size as rows of one card", async () => {
        expect(container.querySelectorAll(".tn-card")).toHaveLength(1);
        expect(container.querySelector(".tn-card-heading")).toBeNull();
        const labels = [ ...container.querySelectorAll(".tn-card-option-title") ]
            .map((label) => label.textContent);
        expect(labels).toStrictEqual([ "include_note.label_note", "include_note.box_size" ]);
        expect(container.querySelector(".include-note-note input")).not.toBeNull();
        expect([ ...sizeSelect().options ].map((option) => option.textContent)).toStrictEqual([
            "include_note.size_tiny", "include_note.size_small", "include_note.size_medium",
            "include_note.size_full", "include_note.size_expandable"
        ]);
        expect(checkedSize()).toBe("medium");
        await choose("tiny");
        expect(checkedSize()).toBe("tiny");
    });

    it("preselects the size that suits the picked note, until another size is chosen", async () => {
        const script = buildNote({ title: "Script", type: "code", mime: "text/javascript" });
        const song = buildNote({ title: "Song", type: "file", mime: "audio/mpeg" });
        expect(checkedSize()).toBe("medium");

        await pick(script);
        expect(checkedSize()).toBe("full");
        await choose("tiny");
        expect(checkedSize()).toBe("tiny");

        // Another note drops the size chosen by hand.
        await pick(song);
        expect(checkedSize()).toBe("small");
        await choose("expandable");
        await submit();
        expect(editorApi.addContentEmbed).toHaveBeenCalledWith(song.noteId, "expandable");
    });

    it("forgets the note picked the last time it was open", async () => {
        const script = buildNote({ title: "Script", type: "code", mime: "text/javascript" });
        await pick(script);
        await submit();
        expect(editorApi.addContentEmbed).toHaveBeenCalledExactlyOnceWith(script.noteId, "full");

        autocomplete.clear.mockClear();
        await open();
        expect(autocomplete.clear).toHaveBeenCalledOnce();
        expect(checkedSize()).toBe("medium");
        await submit();
        expect(editorApi.addContentEmbed).toHaveBeenCalledOnce();
    });
});
