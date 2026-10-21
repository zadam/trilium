import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../../components/component";
import type { Suggestion } from "../../services/note_autocomplete";
import { buildNote } from "../../test/easy-froca";
import { renderInto } from "../../test/render";
import { ParentComponent } from "../react/react_utils";
import AddLinkDialog, { type AddLinkOpts, normalizeWebLink } from "./add_link";

const autocomplete = vi.hoisted(() => ({
    onChange: undefined as ((suggestion: Suggestion | null) => void) | undefined
}));

vi.mock("../../services/i18n", () => ({ t: (key: string) => key }));
vi.mock("../react/NoteAutocomplete", () => ({
    default: ({ onChange }: { onChange: (suggestion: Suggestion | null) => void }) => {
        autocomplete.onChange = onChange;
        return <input className="note-autocomplete" />;
    }
}));

describe("normalizeWebLink", () => {
    it("adds https:// to an address without a scheme, and keeps any other scheme", () => {
        expect(normalizeWebLink(" example.com/a ")).toBe("https://example.com/a");
        expect(normalizeWebLink("localhost:8080")).toBe("https://localhost:8080");
        expect(normalizeWebLink("http://example.com")).toBe("http://example.com");
        expect(normalizeWebLink("mailto:someone@example.com")).toBe("mailto:someone@example.com");
        expect(normalizeWebLink("  ")).toBeNull();
    });
});

describe("AddLinkDialog", () => {
    let host: Component;
    let container: HTMLElement;
    const addLink = vi.fn<AddLinkOpts["addLink"]>(async () => {});

    beforeEach(() => {
        vi.clearAllMocks();
        autocomplete.onChange = undefined;
        host = new Component();
        container = renderInto(
            <ParentComponent.Provider value={host}>
                <AddLinkDialog />
            </ParentComponent.Provider>
        );
    });

    async function open(opts: Partial<AddLinkOpts> = {}) {
        await act(async () => {
            void host.handleEventInChildren("showAddLinkDialog", {
                text: "", hasSelection: false, addLink, ...opts
            });
        });
    }

    function choice() {
        return [ ...container.querySelectorAll<HTMLButtonElement>(".tn-segmented-choice button") ];
    }

    function current() {
        return choice().find((button) => button.classList.contains("active"))?.textContent?.trim();
    }

    function field(name: "url" | "text") {
        return container.querySelector<HTMLInputElement>(`.add-link-${name} input`);
    }

    async function type(input: HTMLInputElement | null, value: string) {
        if (!input) throw new Error("The field is not shown.");
        await act(async () => {
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
    }

    async function submit() {
        const form = container.querySelector("form");
        const modal = container.querySelector(".modal");
        if (!form || !modal) throw new Error("The dialog has no form.");
        await act(async () => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            modal.dispatchEvent(new Event("hidden.bs.modal"));
        });
    }

    it("inserts a typed web link, titled by its URL unless given a text", async () => {
        await open();
        expect(choice().map((button) => button.textContent?.trim()))
            .toStrictEqual([ "add_link.note", "add_link.web_link" ]);
        expect(current()).toBe("add_link.note");
        expect(container.querySelector(".note-autocomplete")).not.toBeNull();

        await act(async () => choice()[1]?.click());
        expect(current()).toBe("add_link.web_link");
        expect(container.querySelector(".note-autocomplete")).toBeNull();
        expect(field("url")?.inputMode).toBe("url");

        await type(field("url"), "example.com");
        await submit();
        expect(addLink)
            .toHaveBeenLastCalledWith("https://example.com", "https://example.com", true);

        await open();
        await act(async () => choice()[1]?.click());
        await type(field("url"), "https://trilium.cc");
        await type(field("text"), "Trilium");
        await submit();
        expect(addLink).toHaveBeenLastCalledWith("https://trilium.cc", "Trilium", true);
    });

    it("still links a note picked on the note side", async () => {
        const note = buildNote({ title: "Target" });
        await open();
        await act(async () => autocomplete.onChange?.({ notePath: `root/${note.noteId}` }));
        await submit();
        expect(addLink).toHaveBeenCalledExactlyOnceWith(`root/${note.noteId}`, null);
    });

    it("opens on the web link side for an edited external link or a selected URL", async () => {
        await open({ currentLink: { externalLink: "https://example.com/page" } });
        expect(current()).toBe("add_link.web_link");
        expect(field("url")?.value).toBe("https://example.com/page");

        await open({ text: "https://example.org", hasSelection: true });
        expect(current()).toBe("add_link.web_link");
        expect(field("url")?.value).toBe("https://example.org");
        // The selected text is the link's text.
        expect(field("text")).toBeNull();

        await open({ text: "some words", hasSelection: true });
        expect(current()).toBe("add_link.note");
    });

    it("moves a URL typed or pasted on the note side over to the web link side", async () => {
        await open();
        await act(async () => autocomplete.onChange?.({ externalLink: "https://typed.example" }));
        expect(current()).toBe("add_link.web_link");
        expect(field("url")?.value).toBe("https://typed.example");

        await open();
        const paste = new Event("paste", { bubbles: true, cancelable: true });
        const clipboardData = { getData: () => " https://pasted.example " };
        Object.defineProperty(paste, "clipboardData", { value: clipboardData });
        await act(async () => {
            container.querySelector(".note-autocomplete")?.dispatchEvent(paste);
        });
        expect(paste.defaultPrevented).toBe(true);
        expect(current()).toBe("add_link.web_link");
        expect(field("url")?.value).toBe("https://pasted.example");
    });

    it("offers no web link when fixing a link to a missing note", async () => {
        await open({ text: "Gone", fixLink: true });
        expect(choice()).toStrictEqual([]);
        expect(container.querySelector(".note-autocomplete")).not.toBeNull();
    });
});
