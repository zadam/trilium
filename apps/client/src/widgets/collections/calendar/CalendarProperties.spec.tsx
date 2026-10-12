import { Modal as BootstrapModal } from "bootstrap";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type FNote from "../../../entities/fnote";
import type { CalendarViewData } from "./api";
import CalendarProperties from "./CalendarProperties";

// i18next is never initialised under test, so every label would read as undefined.
vi.mock("../../../services/i18n", () => ({
    t: (key: string) => key
}));

/** What the stubbed card reports on the next click. */
let reported: string[] = [];

// TemplateSelectionCard is tested in its own spec. What this dialog decides is the labels it
// passes and where onChange writes.
vi.mock("../../react/TemplateSelectionCard", () => ({
    default: ({ heading, instruction, note, newTemplateName, templates, onChange }: {
        heading: string, instruction: string, note: FNote, newTemplateName?: string,
        templates: string[], onChange: (templates: string[]) => void
    }) => (
        <div
            className="templates-stub"
            data-heading={heading}
            data-instruction={instruction}
            data-note={note.noteId}
            data-new-name={newTemplateName}
            data-templates={templates.join(",")}
            onClick={() => onChange(reported)}
        />
    )
}));

describe("CalendarProperties", () => {
    let container: HTMLElement;
    let saved: CalendarViewData[];
    const calendar = { noteId: "calendar1" } as FNote;

    function draw(viewConfig: CalendarViewData | undefined) {
        act(() => {
            render(
                <CalendarProperties
                    note={calendar}
                    viewConfig={viewConfig}
                    saveConfig={(config) => saved.push(config)}
                    onClose={() => {}}
                />,
                container);
        });
        return document.querySelector<HTMLElement>(".calendar-properties-dialog .templates-stub");
    }

    beforeEach(() => {
        saved = [];
        reported = [];
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        // Unmounted before Bootstrap is disposed: a modal Bootstrap still believes is shown traps
        // the focus of every later test.
        render(null, container);
        container.remove();

        const modal = document.querySelector<HTMLElement>(".calendar-properties-dialog");
        if (modal) {
            BootstrapModal.getInstance(modal)?.dispose();
            modal.remove();
        }

        document.querySelector(".modal-backdrop")?.remove();
        document.body.classList.remove("modal-open");
    });

    it("holds the event templates, offering text until the calendar has its own", () => {
        const card = draw(undefined);

        expect(document.querySelector(".calendar-properties-dialog .modal-title")?.textContent)
            .toContain("calendar_view.properties");
        expect(card?.dataset.heading).toBe("calendar_view.event_templates");
        expect(card?.dataset.instruction).toBe("calendar_view.event_templates_hint");
        expect(card?.dataset.note).toBe("calendar1");
        expect(card?.dataset.newName).toBe("calendar_view.new_template_name");
        expect(card?.dataset.templates).toBe("type:text:text/html");

        expect(draw({ templates: [ "note:mine" ] })?.dataset.templates).toBe("note:mine");
    });

    /** On a phone the new-event form is itself a dialog, opened before this one from its template field. */
    it("opens over the dialog already open rather than closing it", () => {
        const sheet = document.createElement("div");
        sheet.className = "modal";
        document.body.appendChild(sheet);
        glob.activeDialog = $(sheet);

        try {
            draw(undefined);
            expect(glob.activeDialog?.[0]).toBe(sheet);
        } finally {
            glob.activeDialog = null;
            sheet.remove();
        }
    });

    it("stores what the card reports beside the rest of the config, and refuses an empty list", () => {
        const card = draw({ templates: [ "type:text:text/html" ], template: "type:text:text/html" });
        expect(card).not.toBeNull();

        reported = [ "type:canvas:application/json", "note:mine" ];
        act(() => card?.click());
        expect(saved).toEqual([ {
            templates: [ "type:canvas:application/json", "note:mine" ],
            template: "type:text:text/html"
        } ]);

        reported = [];
        act(() => card?.click());
        expect(saved).toHaveLength(1);
    });
});
