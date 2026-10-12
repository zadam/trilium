import { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import FNote from "../../../entities/fnote";
import { t } from "../../../services/i18n";
import LabelValueInput from "../../attribute_widgets/label_value_input";
import { EventDuration, EventRow, EventTimeRow } from "./EventField";
import { useEventLabel } from "./hooks";
import { EventDraft, normalizeEventDates, withAllDay, withStart } from "./selection";

/**
 * Edits when an existing event happens, through the date and time labels the calendar draws it by
 * (see event_builder.ts) — under whatever names the note draws them by, a `#calendar:startDate`
 * renaming included (see useEventLabel). The fields are {@link EventDatesFields}, shared with the
 * new-event popup; this writes back only the labels an edit changed, then adds the repeats row.
 */
export default function EventDatesEditor({ note, repeats }: {
    note: FNote;
    /** The repeats field, shown on a row of its own below the hours. */
    repeats?: ComponentChildren;
}) {
    const [ startDate, setStartDate ] = useEventLabel(note, "startDate");
    const [ endDate, setEndDate ] = useEventLabel(note, "endDate");
    const [ startTime, setStartTime ] = useEventLabel(note, "startTime");
    const [ endTime, setEndTime ] = useEventLabel(note, "endTime");

    // All day is the absence of a start time, which is how the event builder reads it too. Held
    // locally so the time row answers the press at once — the labels the press writes come back only
    // with the server's echo — and follows the note's own state wherever it changes from.
    const storedAllDay = !startTime;
    const [ allDay, setAllDay ] = useState(storedAllDay);
    useEffect(() => setAllDay(storedAllDay), [ storedAllDay ]);

    const value: EventDraft = { startDate: startDate ?? "", endDate, startTime, endTime };
    const onChange = (next: EventDraft) => {
        setAllDay(!next.startTime);
        if (next.startDate !== value.startDate) setStartDate(next.startDate);
        if ((next.endDate ?? null) !== endDate) setEndDate(next.endDate ?? null);
        if ((next.startTime ?? null) !== startTime) setStartTime(next.startTime ?? null);
        if ((next.endTime ?? null) !== endTime) setEndTime(next.endTime ?? null);
    };

    return (
        <>
            <EventDatesFields value={value} allDay={allDay} onChange={onChange} />

            {repeats && (
                <EventRow icon="bx-repeat" title={t("calendar.recurrence.repeats")}>
                    {repeats}
                </EventRow>
            )}
        </>
    );
}

/**
 * The date and time rows of an event, shared by the event popover and the new-event popup. The
 * date row holds a start date and, where the event runs longer than a day, an end date; the time
 * row holds the hours and their duration, or the button to add them for an all-day event. Fields
 * commit as they are left, and hand the whole edited event to `onChange`.
 */
export function EventDatesFields({ value, allDay, onChange }: {
    value: EventDraft;
    /** Whether the time row offers to add hours. Given separately from `value` so a host can
     *  answer a press ahead of the value it writes coming back. */
    allDay: boolean;
    onChange(next: EventDraft): void;
}) {
    // Shown and handed on with the end date it actually ends on, which an edit then writes back.
    const event = normalizeEventDates(value);
    const { startDate, endDate, startTime, endTime } = event;
    const change = (next: EventDraft) => onChange(normalizeEventDates(next));

    return (
        <>
            <EventRow icon="bx-calendar" title={t("calendar.dates.date")}>
                <LabelValueInput
                    labelType="date"
                    value={startDate}
                    commitOn="blur"
                    // Never emptied: without a start date the note stops being an event at all.
                    // The field snaps back.
                    onCommit={(date) => date && change(withStart(event, { startDate: date }))}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.start_date") }}
                />
                <span className="calendar-event-row-separator" aria-hidden="true">–</span>
                <LabelValueInput
                    labelType="date"
                    value={endDate ?? ""}
                    commitOn="blur"
                    // Emptied, the event ends on the day it starts: the label goes rather than
                    // staying blank, which is how the builder reads a single-day event.
                    onCommit={(date) => change({ ...event, endDate: date || null })}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.end_date") }}
                />
            </EventRow>

            <EventTimeRow
                hasTime={!allDay}
                onAdd={() => change(withAllDay(event, false))}
                onRemove={() => change(withAllDay(event, true))}
            >
                <LabelValueInput
                    labelType="time"
                    value={startTime ?? ""}
                    commitOn="blur"
                    // Never emptied either: a timed event without a start time is the all-day
                    // shape, and the button beside the hours is the way to say that.
                    onCommit={(time) => time && change(withStart(event, { startTime: time }))}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.start_time") }}
                />
                <span className="calendar-event-row-separator" aria-hidden="true">–</span>
                <LabelValueInput
                    labelType="time"
                    value={endTime ?? ""}
                    commitOn="blur"
                    onCommit={(time) => time && change({ ...event, endTime: time })}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.end_time") }}
                />
                {startDate && <EventDuration event={event} />}
            </EventTimeRow>
        </>
    );
}
