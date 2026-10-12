import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GhostPopover from "./GhostPopover";
import { EventDraft } from "./selection";

// i18next is never initialized under test, so t() renders the key with the interpolated values
// appended, e.g. "calendar_view.duration_hours_minutes|1|30".
vi.mock("../../../services/i18n", () => ({
    t: (key: string, opts?: Record<string, unknown>) => [ key, ...Object.values(opts ?? {}) ].join("|")
}));

describe("GhostPopover", () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        document.body.innerHTML = "";
    });

    const draft: EventDraft = { startDate: "2026-06-05" };

    function mount(onCommit: (title: string) => Promise<void> | void) {
        act(() => render(
            <GhostPopover
                draft={draft}
                anchor={{ x: 10, y: 10 }}
                container={container}
                onCommit={onCommit}
                onCancel={() => {}}
                onDismiss={() => {}}
            />,
            container));
    }

    /** The form's only button, which is the one that asks for the note. */
    const createButton = () => document.querySelector<HTMLButtonElement>(".calendar-ghost-actions button");
    const titleInput = () => document.querySelector<HTMLInputElement>(".calendar-ghost-body input");
    const timeInputs = () => [ ...document.querySelectorAll<HTMLInputElement>(".calendar-ghost-body input[type=time]") ];
    const duration = () => document.querySelector(".calendar-event-duration")?.textContent;

    it("asks for the note once, however many times the ask is made before it arrives", async () => {
        // A request still out, which is the window each further Enter would make its own note in.
        const onCommit = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        mount(onCommit);

        act(() => { createButton()?.click(); });
        act(() => { createButton()?.click(); });

        expect(onCommit).toHaveBeenCalledTimes(1);
        // Held shut for as long as the asking lasts.
        expect(createButton()?.disabled).toBe(true);
    });

    it("opens the form again where the note could not be made, keeping the title for another try", async () => {
        const onCommit = vi.fn().mockRejectedValue(new Error("the server said no"));
        mount(onCommit);

        const input = titleInput();
        if (!input) throw new Error("The ghost has no title field.");
        input.value = "Fair";
        act(() => { input.dispatchEvent(new Event("input", { bubbles: true })); });

        await act(async () => { createButton()?.click(); });

        // Nothing was created and the calendar keeps the ghost up, so the button that asks must be
        // pressable again — otherwise the title just typed can only be discarded.
        expect(createButton()?.disabled).toBe(false);
        expect(titleInput()?.value).toBe("Fair");

        // And a second try really does ask again.
        await act(async () => { createButton()?.click(); });
        expect(onCommit).toHaveBeenCalledTimes(2);
        expect(onCommit).toHaveBeenLastCalledWith("Fair", draft);
    });

    it("focuses the title field once the popover is shown", async () => {
        // `Popover` keeps the card hidden until `placeFloating()` resolves, and a browser ignores
        // `focus()` on a hidden element, so the field must be focused only once the card shows.
        const visibilityAtFocus: string[] = [];
        const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement) {
            visibilityAtFocus.push(this.closest<HTMLElement>(".tn-popover")?.style.visibility ?? "");
        });
        try {
            mount(vi.fn());
            await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
        } finally {
            focus.mockRestore();
        }

        expect(visibilityAtFocus).not.toHaveLength(0);
        expect(visibilityAtFocus.every((visibility) => visibility === "visible")).toBe(true);
    });

    it("hands over the title as typed, an empty one standing for the calendar's own naming", async () => {
        const onCommit = vi.fn().mockResolvedValue(undefined);
        mount(onCommit);

        await act(async () => { createButton()?.click(); });

        // Committing blank is meaningful: the note is then named by the calendar's #titleTemplate.
        expect(onCommit).toHaveBeenCalledWith("", draft);
    });

    it("lets a whole-day draft be given hours before it is created", async () => {
        const onCommit = vi.fn().mockResolvedValue(undefined);
        mount(onCommit);

        const allDay = document.querySelector<HTMLInputElement>(".calendar-event-switches .switch-toggle");
        if (!allDay) throw new Error("The ghost has no all-day switch.");
        expect(allDay.checked).toBe(true);
        expect(timeInputs()).toHaveLength(0);
        expect(duration()).toBeUndefined();

        act(() => { allDay.dispatchEvent(new Event("input", { bubbles: true })); });
        const [ start, end ] = timeInputs();
        expect(start.value).toBe("09:00");
        expect(end.value).toBe("10:00");
        expect(duration()).toBe("calendar_view.duration_hours|1");

        start.value = "14:00";
        act(() => { start.dispatchEvent(new Event("input", { bubbles: true })); });
        end.value = "15:30";
        act(() => { end.dispatchEvent(new Event("input", { bubbles: true })); });
        expect(duration()).toBe("calendar_view.duration_hours_minutes|1|30");
        expect(timeInputs()[0].closest(".calendar-event-row")?.querySelector(".calendar-event-duration")).not.toBeNull();
        await act(async () => { createButton()?.click(); });

        expect(onCommit).toHaveBeenCalledWith("", {
            startDate: "2026-06-05", endDate: null, startTime: "14:00", endTime: "15:30"
        });
    });
});
