import { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import FNote from "../../../entities/fnote";
import { t } from "../../../services/i18n";
import LabelValueInput from "../../attribute_widgets/label_value_input";
import FormToggle from "../../react/FormToggle";
import { EventDuration, EventRow } from "./EventField";
import { useEventLabel } from "./hooks";
import { DEFAULT_END_TIME, DEFAULT_START_TIME } from "./selection";

/**
 * Edits when the event happens, through the date and time labels the calendar draws it by (see
 * event_builder.ts) — under whatever names the note draws them by, a `#calendar:startDate`
 * renaming included (see useEventLabel). Two shapes, told apart by the all-day switch: a whole-day
 * event is a span of days — a start date and, where it runs longer, an end date — while a timed
 * one is a single day and the hours within it. Rendered as {@link EventRow} lines: the date, the
 * all-day switch beside the repeats field, and for a timed event the hours and their duration.
 */
export default function EventDatesEditor({ note, repeats }: {
    note: FNote;
    /** The repeats field, shown beside the all-day switch. */
    repeats?: ComponentChildren;
}) {
    const [ startDate, setStartDate ] = useEventLabel(note, "startDate");
    const [ endDate, setEndDate ] = useEventLabel(note, "endDate");
    const [ startTime, setStartTime ] = useEventLabel(note, "startTime");
    const [ endTime, setEndTime ] = useEventLabel(note, "endTime");

    // All day is the absence of a start time, which is how the event builder reads it too. Held
    // locally so the switch answers the press at once — the labels the press writes come back only
    // with the server's echo — and follows the note's own state wherever it changes from.
    const storedAllDay = !startTime;
    const [ allDay, setAllDay ] = useState(storedAllDay);
    useEffect(() => setAllDay(storedAllDay), [ storedAllDay ]);

    const toggleAllDay = (on: boolean) => {
        setAllDay(on);
        if (on) {
            // A whole day has no hours; the dates stay as they were.
            setStartTime(null);
            setEndTime(null);
        } else {
            // A timed event is said within one day, so a span of days is let go rather than kept
            // where the fields no longer show it. The hours are a foothold to edit, not a guess.
            setStartTime(DEFAULT_START_TIME);
            setEndTime(endTime ?? DEFAULT_END_TIME);
            setEndDate(null);
        }
    };

    return (
        <>
            <EventRow icon="bx-calendar" title={t("calendar.dates.date")}>
                <LabelValueInput
                    labelType="date"
                    value={startDate ?? ""}
                    commitOn="blur"
                    // Never emptied: without a start date the note stops being an event at all,
                    // and the dock is no place to do that by accident. The field snaps back.
                    onCommit={(value) => value && setStartDate(value)}
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
                        onCommit={(value) => setEndDate(value || null)}
                        inputProps={{ className: "form-control", "aria-label": t("calendar.dates.end_date") }}
                    />
                </>}
            </EventRow>

            <EventRow>
                <div className="calendar-event-switches">
                    <FormToggle
                        switchOnName={t("calendar.dates.all_day")}
                        switchOffName={t("calendar.dates.all_day")}
                        currentValue={allDay}
                        onChange={toggleAllDay}
                    />
                    {repeats}
                </div>
            </EventRow>

            {!allDay && (
                <EventRow icon="bx-time-five" title={t("calendar.dates.time")}>
                    <LabelValueInput
                        labelType="time"
                        value={startTime ?? ""}
                        commitOn="blur"
                        // Never emptied either: a timed event without a start time is the
                        // all-day shape, and the switch above is the way to say that.
                        onCommit={(value) => value && setStartTime(value)}
                        inputProps={{ className: "form-control", "aria-label": t("calendar.dates.start_time") }}
                    />
                    <span className="calendar-event-row-separator" aria-hidden="true">–</span>
                    <LabelValueInput
                        labelType="time"
                        value={endTime ?? ""}
                        commitOn="blur"
                        onCommit={(value) => value && setEndTime(value)}
                        inputProps={{ className: "form-control", "aria-label": t("calendar.dates.end_time") }}
                    />
                    {startDate && <EventDuration event={{ startDate, endDate, startTime, endTime }} />}
                </EventRow>
            )}
        </>
    );
}
