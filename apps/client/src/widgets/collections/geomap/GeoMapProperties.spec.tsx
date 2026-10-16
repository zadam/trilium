import { Modal as BootstrapModal } from "bootstrap";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type FNote from "../../../entities/fnote";
import { buildNote } from "../../../test/easy-froca";
import GeoMapProperties, { type GeoMapImageState } from "./GeoMapProperties";

vi.mock("../../../services/i18n", () => ({
    t: (key: string) => key
}));
// The settings dropdown's definitions translate through i18next directly, at import.
vi.mock("i18next", async (importOriginal) => ({
    ...await importOriginal<typeof import("i18next")>(),
    t: (key: string) => key
}));

const mocks = vi.hoisted(() => ({
    setLabel: vi.fn(async () => {}),
    removeOwnedLabelByName: vi.fn(async () => {}),
    removeOwnedRelationByName: vi.fn(async () => {}),
    setAttribute: vi.fn(async () => {})
}));

vi.mock("../../../services/attributes", () => ({
    default: {
        setLabel: mocks.setLabel,
        removeOwnedLabelByName: mocks.removeOwnedLabelByName,
        removeOwnedRelationByName: mocks.removeOwnedRelationByName,
        setAttribute: mocks.setAttribute,
        isAffecting: () => true
    }
}));

// NoteAutocomplete is tested in its own spec. A click on the stub picks `image2`.
vi.mock("../../react/NoteAutocomplete", () => ({
    default: ({ noteId, noteIdChanged }: {
        noteId?: string, noteIdChanged: (noteId: string) => void
    }) => (
        <div
            className="autocomplete-stub"
            data-note-id={noteId ?? ""}
            onClick={() => noteIdChanged("image2")}
        />
    )
}));

const LOADED_IMAGE: GeoMapImageState = { status: "image", size: { width: 2048, height: 1024 } };

describe("GeoMapProperties", () => {
    let container: HTMLElement;

    function draw(labels: Record<string, string>, image: GeoMapImageState = { status: "geo" }) {
        const note = buildNote({ title: "Map", ...labels }) as unknown as FNote;
        act(() => {
            render(<GeoMapProperties note={note} image={image} onClose={() => {}} />, container);
        });
        return note;
    }

    function query<T extends Element = HTMLElement>(selector: string) {
        return document.querySelector<T>(`.geo-map-properties-dialog ${selector}`);
    }

    function optionTitles(selector: string) {
        const titles = document.querySelectorAll(
            `.geo-map-properties-dialog ${selector} .tn-card-option-title`);
        return [ ...titles ].map((title) => title.textContent);
    }

    function cornerInputs() {
        return [ ...document.querySelectorAll<HTMLInputElement>(
            ".geo-map-properties-dialog .geo-map-corner input") ];
    }

    /** The background type the dropdown shows as chosen. */
    function backgroundType() {
        return query(".geo-map-background-type .dropdown > button")?.textContent?.trim();
    }

    /** Opens the background type dropdown, unless it is open, and returns its items. */
    function openBackgroundTypes() {
        const toggle = query(".geo-map-background-type .dropdown > button");
        if (!toggle) throw new Error("no background type dropdown");
        if (toggle.getAttribute("aria-expanded") !== "true") {
            act(() => toggle.click());
        }
        return [ ...document.querySelectorAll<HTMLElement>(".dropdown-item") ];
    }

    function choose(label: string) {
        const item = openBackgroundTypes()
            .find((candidate) => candidate.textContent?.trim().startsWith(label));
        if (!item) throw new Error(`no ${label} item`);
        act(() => item.click());
    }

    function coordinateButtons() {
        return [ ...document.querySelectorAll<HTMLButtonElement>(
            ".geo-map-properties-dialog .geo-map-coordinates .tn-segmented-choice button") ];
    }

    /** The coordinate modes, as their labels and whether each is the chosen one. */
    function coordinateModes() {
        return coordinateButtons()
            .map((button) => [ button.textContent?.trim(), button.classList.contains("active") ]);
    }

    function chooseCoordinateMode(label: string) {
        const button = coordinateButtons()
            .find((candidate) => candidate.textContent?.trim() === label);
        if (!button) throw new Error(`no ${label} button`);
        act(() => button.click());
    }

    /** Types `value` into `input` and leaves it, which is when a number box commits. */
    function commit(input: HTMLInputElement | undefined, value: string) {
        if (!input) throw new Error("no such input");
        act(() => {
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change"));
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();

        const modal = document.querySelector<HTMLElement>(".geo-map-properties-dialog");
        if (modal) {
            BootstrapModal.getInstance(modal)?.dispose();
            modal.remove();
        }

        document.querySelector(".modal-backdrop")?.remove();
        document.body.classList.remove("modal-open");
    });

    it("repeats the settings dropdown in a General card, except the map style", () => {
        draw({});
        expect(document.querySelector(".geo-map-properties-dialog .modal-title")?.textContent)
            .toContain("geo-map.properties-title");
        expect(optionTitles(".geo-map-properties-general")).toEqual([
            "book_properties_config.show-scale",
            "book_properties_config.show-labels",
            "book_properties_config.cluster-markers"
        ]);
    });

    it("holds which notes the map gathers in a card of their own, after General", () => {
        draw({});
        const included = query(".collection-included-notes");
        expect(optionTitles(".collection-included-notes")).toEqual([
            "book_properties.include_archived_notes",
            "book_properties_config.max-nesting-depth"
        ]);
        expect(query(".geo-map-properties-general")?.compareDocumentPosition(included as Node))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(included?.compareDocumentPosition(query(".geo-map-properties-background") as Node))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("draws a world map with a style, until a custom image is chosen and picked", () => {
        const note = draw({});
        expect(backgroundType()).toBe("geo-map.background-map");
        expect(openBackgroundTypes().map((item) => item.textContent?.trim())).toEqual([
            "geo-map.background-mapgeo-map.background-map-description",
            "geo-map.background-imagegeo-map.background-image-description"
        ]);
        expect(optionTitles(".geo-map-properties-background")).toEqual([
            "geo-map.background-type", "book_properties_config.map-style"
        ]);

        // Choosing the image writes nothing: the map stays a world map until an image is picked.
        choose("geo-map.background-image");
        expect(optionTitles(".geo-map-properties-background")).toEqual([
            "geo-map.background-type", "geo-map.image-note"
        ]);
        expect(mocks.setAttribute).not.toHaveBeenCalled();

        act(() => query(".autocomplete-stub")?.click());
        expect(mocks.setAttribute).toHaveBeenCalledWith(note, "relation", "map:image", "image2");
    });

    it("goes back to a world map by removing the image", () => {
        const note = draw({ "~map:image": "image1" }, LOADED_IMAGE);
        expect(backgroundType()).toBe("geo-map.background-image");

        choose("geo-map.background-map");
        expect(mocks.removeOwnedRelationByName).toHaveBeenCalledWith(note, "map:image");
        expect(optionTitles(".geo-map-properties-background")).toEqual([
            "geo-map.background-type", "book_properties_config.map-style"
        ]);
    });

    it("measures in pixels until custom corners are chosen, starting them at the size", () => {
        const note = draw({ "~map:image": "image1" }, LOADED_IMAGE);
        expect(query(".autocomplete-stub")?.dataset.noteId).toBe("image1");
        expect(optionTitles(".geo-map-properties-background")).toEqual([
            "geo-map.background-type", "geo-map.image-note",
            "geo-map.coordinates", "geo-map.dark-image"
        ]);
        expect(cornerInputs()).toHaveLength(0);

        expect(coordinateModes()).toEqual([
            [ "geo-map.coordinates-pixels", true ], [ "geo-map.coordinates-custom", false ]
        ]);
        chooseCoordinateMode("geo-map.coordinates-custom");
        expect(mocks.setLabel)
            .toHaveBeenCalledWith(note.noteId, "map:imageBounds", "0,0 2048,1024");
    });

    it("stores corners once they span the image, and removes them to return to pixels", () => {
        const note = draw(
            { "~map:image": "image1", "#map:imageBounds": "-512,512 512,-512" }, LOADED_IMAGE);
        const inputs = cornerInputs();
        expect(inputs.map((input) => input.value)).toEqual([ "-512", "512", "512", "-512" ]);

        // A right edge on the left one spans nothing, so it is held back and explained.
        commit(inputs[2], "-512");
        expect(mocks.setLabel).not.toHaveBeenCalled();
        expect(query(".geo-map-coordinates-error")?.textContent)
            .toBe("geo-map.coordinates-invalid");

        commit(inputs[2], "1024.5");
        expect(mocks.setLabel)
            .toHaveBeenCalledWith(note.noteId, "map:imageBounds", "-512,512 1024.5,-512");
        expect(query(".geo-map-coordinates-error")).toBeNull();

        expect(coordinateModes()).toEqual([
            [ "geo-map.coordinates-pixels", false ], [ "geo-map.coordinates-custom", true ]
        ]);
        chooseCoordinateMode("geo-map.coordinates-pixels");
        expect(mocks.removeOwnedLabelByName).toHaveBeenCalledWith(note, "map:imageBounds");
    });

    it("says why an image cannot be drawn, or might not be on every device", () => {
        draw({ "~map:image": "image1" }, { status: "error", reason: "svg" });
        expect(query(".geo-map-image-notice")?.textContent).toBe("geo-map.image-svg-unsupported");

        render(null, container);
        draw({ "~map:image": "image1" }, { status: "image", size: { width: 8192, height: 2048 } });
        expect(query(".geo-map-image-notice")?.textContent).toBe("geo-map.image-too-large");

        render(null, container);
        draw({ "~map:image": "image1" }, LOADED_IMAGE);
        expect(query(".geo-map-image-notice")).toBeNull();
    });
});
