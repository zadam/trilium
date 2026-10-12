import "./EventField.css";

import clsx from "clsx";
import { ComponentChildren } from "preact";

import { t } from "../../../services/i18n";
import { getTimedDurationMinutes } from "./utils";

/**
 * The column of an event's own fields — how the event popover says what the calendar draws the
 * event by (its recurrence, and in time its start and end dates), those being kept out of the
 * promoted grid (see EVENT_LABELS in EventPopover.tsx). One shared shape so every field of the
 * event reads as a row of the same form.
 */
export function EventFieldList({ children }: { children: ComponentChildren }) {
    return <div className="calendar-event-fields">{children}</div>;
}

/**
 * One field of the event: its name over whatever edits it. The name is a `<label>` where there is
 * one input to speak for ({@link htmlFor}), and reads as a heading where the field is a group —
 * a row of weekday toggles has no single input to point at.
 */
export function EventField({ name, htmlFor, compact, children }: {
    name: ComponentChildren;
    /** The id of the field's input, for a field that has exactly one. */
    htmlFor?: string;
    /** Take no more of a shared line than the field's own name and control need, leaving the rest
     *  to whatever stands beside it (see {@link EventFieldRow}). */
    compact?: boolean;
    children: ComponentChildren;
}) {
    return (
        <div className={clsx("calendar-event-field", compact && "calendar-event-field-compact")}>
            <label className="calendar-event-field-name" for={htmlFor}>{name}</label>
            {children}
        </div>
    );
}

/**
 * Two or more whole fields sharing one line, each with its own name over its own control — for
 * fields short enough that a line apiece would leave the column mostly air.
 */
export function EventFieldRow({ children }: { children: ComponentChildren }) {
    return <div className="calendar-event-field-row">{children}</div>;
}

/**
 * Controls standing in one line, for a field said as a sentence — "every [2] weeks", "after [10]
 * times" — rather than as a single box.
 */
export function EventFieldControls({ className, children }: {
    className?: string;
    children: ComponentChildren;
}) {
    return <div className={clsx("calendar-event-field-controls", className)}>{children}</div>;
}

/**
 * How long a timed event lasts, appended to the line that summarizes when it happens. Renders
 * nothing for an all-day event. An end before the start reads as running into the next day (see
 * {@link getTimedDurationMinutes}).
 */
export function EventDuration({ event }: { event: Parameters<typeof getTimedDurationMinutes>[0] }) {
    const total = getTimedDurationMinutes(event);
    if (total === null) return null;

    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    const text = !hours
        ? t("calendar_view.duration_minutes", { minutes })
        : !minutes
            ? t("calendar_view.duration_hours", { hours })
            : t("calendar_view.duration_hours_minutes", { hours, minutes });
    return <span className="calendar-event-duration"> · {text}</span>;
}
