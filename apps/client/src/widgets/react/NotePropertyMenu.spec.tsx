import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import type FNote from "../../entities/fnote";
import attributes from "../../services/attributes";
import { buildNote } from "../../test/easy-froca";
import { type BookProperty, ViewProperty, ViewPropertySection } from "./NotePropertyMenu";

describe("A collection property's explanation", () => {
    let container: HTMLElement | undefined;

    afterEach(() => {
        if (container) {
            render(null, container);
            container.remove();
            container = undefined;
        }
    });

    async function draw(property: Parameters<typeof ViewProperty>[0]["property"]) {
        const note = buildNote({ title: "Board" }) as unknown as FNote;
        const element = document.createElement("div");
        container = element;
        document.body.appendChild(element);

        await act(async () => {
            render(<ViewProperty note={note} property={property} />, element);
        });
        return element;
    }

    /**
     * The note belongs to a property of any kind, so a button carries one the same way a checkbox
     * does. The label is what it stands beside, which is what this asserts alongside it.
     */
    it("stands beside the label of a property that is not a checkbox", async () => {
        const element = await draw({
            type: "button",
            label: "Collapse",
            icon: "bx bx-layer-minus",
            helpTooltip: "Folds every note under this one.",
            onClick() {}
        });

        expect(element.textContent).toContain("Collapse");
        expect(element.querySelector(".help-tooltip-button")).not.toBeNull();
    });

    it("is left out where the property carries none", async () => {
        const element = await draw({
            type: "button",
            label: "Collapse",
            icon: "bx bx-layer-minus",
            onClick() {}
        });

        expect(element.textContent).toContain("Collapse");
        expect(element.querySelector(".help-tooltip-button")).toBeNull();
    });

    it("stands on a checkbox too, whose label is the switch's own", async () => {
        const element = await draw({
            type: "checkbox",
            label: "Inbox column",
            icon: "bx bx-inbox",
            helpTooltip: "Shows the notes with no column yet.",
            bindToLabel: "board:showInbox"
        });

        expect(element.textContent).toContain("Inbox column");
        expect(element.querySelector(".help-tooltip-button")).not.toBeNull();
    });
});

describe("ViewPropertySection", () => {
    let container: HTMLElement | undefined;

    afterEach(() => {
        if (container) {
            render(null, container);
            container.remove();
            container = undefined;
        }
        vi.restoreAllMocks();
    });

    function draw(note: FNote, properties: BookProperty[]) {
        const element = document.createElement("div");
        container = element;
        document.body.appendChild(element);
        act(() => {
            render(<>{properties.map((property, index) => (
                <ViewPropertySection key={index} note={note} property={property} />
            ))}</>, element);
        });
        return element;
    }

    const titles = (element: HTMLElement) => [ ...element.querySelectorAll(".tn-card-option-title") ]
        .map((title) => title.textContent);

    it("draws a switch, an option group and a submenu as card rows, and nothing for a button", () => {
        const note = buildNote({ title: "Calendar", "#calendar:weekNumbers": "true" }) as unknown as FNote;
        const element = draw(note, [
            { type: "checkbox", label: "Week numbers", bindToLabel: "calendar:weekNumbers" },
            { type: "button", label: "Collapse", onClick() {} },
            {
                type: "submenu", label: "Time slots", children: [
                    {
                        type: "option-group", label: "Duration", bindToLabel: "calendar:slotDuration",
                        defaultValue: "00:30:00",
                        options: [ { value: "00:15:00", label: "15 min" }, { value: "00:30:00", label: "30 min" } ]
                    },
                    { type: "separator" }
                ]
            }
        ]);

        expect(titles(element)).toEqual([ "Week numbers", "Time slots", "Duration" ]);
        expect(element.querySelector(".switch-button")?.classList.contains("on")).toBe(true);
        // The submenu's options stand nested under its own row, showing the default while unset.
        const select = element.querySelector<HTMLSelectElement>(".tn-card-section-nested select");
        expect(select?.value).toBe("00:30:00");
    });

    it("writes the label it is bound to", () => {
        const setLabel = vi.spyOn(attributes, "setLabel").mockResolvedValue(undefined);
        const setBoolean = vi.spyOn(attributes, "setBooleanWithInheritance").mockResolvedValue(undefined);
        const note = buildNote({ title: "Calendar" }) as unknown as FNote;
        const element = draw(note, [
            { type: "checkbox", label: "Hide weekends", bindToLabel: "calendar:hideWeekends" },
            {
                type: "option-group", label: "Duration", bindToLabel: "calendar:slotDuration",
                options: [ { value: "00:15:00", label: "15 min" }, { value: "00:30:00", label: "30 min" } ]
            }
        ]);

        act(() => element.querySelector<HTMLElement>(".switch-button")?.click());
        expect(setBoolean).toHaveBeenCalledWith(note, "calendar:hideWeekends", true);

        const select = element.querySelector<HTMLSelectElement>("select");
        if (!select) throw new Error("The option group has no select.");
        select.value = "00:30:00";
        act(() => { select.dispatchEvent(new Event("change", { bubbles: true })); });
        expect(setLabel).toHaveBeenCalledWith(note.noteId, "calendar:slotDuration", "00:30:00");
    });
});
