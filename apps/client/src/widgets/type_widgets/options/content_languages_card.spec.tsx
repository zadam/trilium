import { LOCALES } from "@triliumnext/commons";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import dialog from "../../../services/dialog";
import options from "../../../services/options";
import { renderInto } from "../../../test/render";
import type { PickerItem } from "../../dialogs/item_picker";
import { ContentLanguagesCard } from "./content_languages_card";

vi.mock("../../../services/i18n", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../services/i18n")>()),
    t: (key: string, values?: Record<string, unknown>) =>
        values ? `${key} ${Object.values(values).join(" ")}` : key
}));

describe("ContentLanguagesCard", () => {
    let originalLanguages: string;

    beforeEach(() => {
        originalLanguages = options.get("languages");
        options.set("languages", JSON.stringify([ "ro", "de", "fr" ]));
    });

    afterEach(() => {
        options.set("languages", originalLanguages);
        window.glob.isDev = false;
        vi.restoreAllMocks();
    });

    it("lists the languages by native name, in alphabetical order and with a globe", () => {
        const container = draw();

        expect(names(container)).toEqual([ "Deutsch", "Français", "Română" ]);
        expect(segments(container).map((element) => element.querySelector(".bx-globe")))
            .not.toContain(null);
        expect(container.querySelector(".tn-sortable-grip")).toBeNull();
        expect(container.querySelector(".content-languages-english-name")).toBeNull();
    });

    it("names each language in English as well in a development build", () => {
        window.glob.isDev = true;
        const container = draw();

        expect(segment(container, "Deutsch")
            ?.querySelector(".content-languages-english-name")?.textContent).toBe("German");
    });

    describe("adding a language", () => {
        it("offers the languages not enabled yet, in alphabetical order", async () => {
            const picking = vi.spyOn(dialog, "pickSingleItem").mockResolvedValue(null);
            const container = draw();

            await click(container.querySelector(".tn-sortable-adder"));

            const items = picking.mock.calls.at(-1)?.[0].items as PickerItem[];
            const keys = items.map((item) => item.key);
            expect(keys).toContain("it");
            expect(keys).not.toContain("de");
            expect(keys).toEqual(LOCALES
                .map((locale) => locale.id)
                .filter((id) => ![ "ro", "de", "fr" ].includes(id)));
            expect(stored()).toEqual([ "ro", "de", "fr" ]);
        });

        it("adds what was picked, keeping the list sorted", async () => {
            vi.spyOn(dialog, "pickSingleItem")
                .mockResolvedValue({ key: "it", caption: "Italiano" });
            const container = draw();

            await click(container.querySelector(".tn-sortable-adder"));

            expect(stored()).toEqual([ "ro", "de", "fr", "it" ]);
            expect(names(container)).toEqual([ "Deutsch", "Français", "Italiano", "Română" ]);
        });

        it("says how many languages are left to add, as the first one or another", () => {
            expect(draw().querySelector(".tn-sortable-adder")?.textContent?.trim())
                .toBe(`content_language.add_another ${LOCALES.length - 3}`);

            options.set("languages", "[]");
            expect(draw().querySelector(".tn-sortable-adder")?.textContent?.trim())
                .toBe(`content_language.add_first ${LOCALES.length}`);
        });
    });

    it("removes a language with its button or Delete", async () => {
        const container = draw();

        await click(segment(container, "Français")?.querySelector(".content-languages-remove")
            ?? null);
        expect(stored()).toEqual([ "ro", "de" ]);

        press(segment(container, "Deutsch"), "Delete");
        expect(stored()).toEqual([ "ro" ]);
        expect(names(container)).toEqual([ "Română" ]);
    });
});

function draw() {
    let container: HTMLElement | undefined;
    act(() => { container = renderInto(<ContentLanguagesCard heading="Languages" />); });
    if (!container) throw new Error("The card did not render");
    return container;
}

function stored() {
    return JSON.parse(options.get("languages"));
}

function segments(container: HTMLElement) {
    return [ ...container.querySelectorAll<HTMLElement>(".tn-sortable-segment") ];
}

function names(container: HTMLElement) {
    return segments(container)
        .map((element) => element.querySelector(".content-languages-native-name")?.textContent);
}

function segment(container: HTMLElement, name: string) {
    return segments(container).find((element) =>
        element.querySelector(".content-languages-native-name")?.textContent === name) ?? null;
}

function press(target: Element | null, key: string) {
    act(() => {
        target?.dispatchEvent(
            new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
}

/** Clicks and waits for what the click awaits, such as the picker. */
async function click(target: Element | null) {
    await act(async () => {
        target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
}
