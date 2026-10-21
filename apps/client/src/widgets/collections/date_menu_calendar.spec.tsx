import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import server from "../../services/server";
import Menu from "../react/Menu";
import DateMenuCalendar from "./date_menu_calendar";

const host = document.createElement("div");
document.body.append(host);

beforeEach(() => {
    vi.useFakeTimers({ toFake: [ "Date" ] });
    vi.setSystemTime(new Date(2026, 9, 21, 12));
});

afterEach(() => {
    act(() => render(null, host));
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("DateMenuCalendar", () => {
    it("opens on the stored date's month with that day marked", () => {
        renderCalendar("2026-03-14");

        expect(title()).toContain("2026");
        expect(day("2026-03-14")?.classList.contains("calendar-date-active")).toBe(true);
        expect(document.querySelector(".calendar-date-today")).toBeNull();
    });

    it("opens on this month without a stored date", () => {
        renderCalendar(undefined);

        expect(day("2026-10-21")?.classList.contains("calendar-date-today")).toBe(true);
        expect(document.querySelector(".calendar-date-active")).toBeNull();
    });

    it("writes the day picked and closes the menu", () => {
        const { onPick, onClose } = renderCalendar(undefined);
        const target = day("2026-10-30");
        expect(target).toBeTruthy();

        act(() => target?.click());

        expect(onPick).toHaveBeenCalledWith("2026-10-30");
        expect(onClose).toHaveBeenCalled();
    });

    it("moves between months without closing the menu", () => {
        const { onClose } = renderCalendar(undefined);
        const [ previous, next ] = document.querySelectorAll<HTMLButtonElement>(".calendar-btn");
        expect(next).toBeTruthy();

        act(() => next?.click());
        expect(day("2026-11-15")?.classList.contains("calendar-date-prev-month")).toBe(false);
        expect(day("2026-11-15")).toBeTruthy();

        act(() => previous?.click());
        act(() => previous?.click());
        expect(day("2026-09-15")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("reads no day notes", () => {
        const get = vi.spyOn(server, "get");
        renderCalendar(undefined);

        expect(get).not.toHaveBeenCalled();
    });
});

function renderCalendar(value: string | undefined) {
    const onPick = vi.fn();
    const onClose = vi.fn();
    act(() => render(
        <Menu
            anchor={{ x: 0, y: 0 }}
            items={[ { kind: "custom", componentFn: () => DateMenuCalendar({ value, onPick }) } ]}
            onClose={onClose}
        />, host));
    return { onPick, onClose };
}

function day(date: string) {
    return document.querySelector<HTMLElement>(`[data-calendar-date="${date}"]`);
}

function title() {
    return document.querySelector(".date-menu-calendar-title")?.textContent ?? "";
}
