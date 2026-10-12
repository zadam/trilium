import { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import FNote from "../../../entities/fnote";
import { t } from "../../../services/i18n";
import LabelValueInput from "../../attribute_widgets/label_value_input";
import { EventDuration, EventRow, EventTimeRow } from "./EventField";
import { useEventLabel } from "./hooks";
import { EventDraft, withAllDay } from "./selection";

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
 * The date and time rows of an event, shared by the event popover and the new-event popup. Two
 * shapes, told apart by whether the event has hours: a whole-day event is a span of days — a start
 * date and, where it runs longer, an end date — while a timed one is a single day and the hours
 * within it, with their duration. Fields commit as they are left, and hand the whole edited event
 * to `onChange`.
 */
export function EventDatesFields({ value, allDay, onChange }: {
    value: EventDraft;
    /** Whether the time row offers to add hours. Given separately from `value` so a host can
     *  answer a press ahead of the value it writes coming back. */
    allDay: boolean;
    onChange(next: EventDraft): void;
}) {
    const { startDate, endDate, startTime, endTime } = value;

    return (
        <>
            <EventRow icon="bx-calendar" title={t("calendar.dates.date")}>
                <LabelValueInput
                    labelType="date"
                    value={startDate}
                    commitOn="blur"
                    // Never emptied: without a start date the note stops being an event at all.
                    // The field snaps back.
                    onCommit={(date) => date && onChange({ ...value, startDate: date })}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.start_date") }}
                />
                {allDay && <>
                    <span className="calendar-event-row-separator" aria-hidden="true">–</span>
                    <LabelValueInput
                        labelType="date"
                        value={endDate ?? ""}
                        commitOn="blur"
                        // Emptied, the event is a single day: the label goes rather than
                        // staying blank, which is how the builder reads a day-long event.
                        onCommit={(date) => onChange({ ...value, endDate: date || null })}
                        inputProps={{ className: "form-control", "aria-label": t("calendar.dates.end_date") }}
                    />
                </>}
            </EventRow>

            <EventTimeRow
                hasTime={!allDay}
                onAdd={() => onChange(withAllDay(value, false))}
                onRemove={() => onChange(withAllDay(value, true))}
            >
                <LabelValueInput
                    labelType="time"
                    value={startTime ?? ""}
                    commitOn="blur"
                    // Never emptied either: a timed event without a start time is the all-day
                    // shape, and the button beside the hours is the way to say that.
                    onCommit={(time) => time && onChange({ ...value, startTime: time })}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.start_time") }}
                />
                <span className="calendar-event-row-separator" aria-hidden="true">–</span>
                <LabelValueInput
                    labelType="time"
                    value={endTime ?? ""}
                    commitOn="blur"
                    onCommit={(time) => time && onChange({ ...value, endTime: time })}
                    inputProps={{ className: "form-control", "aria-label": t("calendar.dates.end_time") }}
                />
                {startDate && <EventDuration event={value} />}
            </EventTimeRow>
        </>
    );
}
