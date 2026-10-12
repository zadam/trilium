import { getTimedDurationMinutes } from "./utils";

/**
 * An event still being decided on: the range the reader dragged out, standing for a note that does
 * not exist yet. Nothing is created until the draft is committed (see GhostPopover), so a ghost
 * dismissed costs nothing — no note to clean up, no tombstone in the sync history.
 */
export interface EventDraft {
    startDate: string;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
}

/** The hours an event gets when it stops being all-day, for the user to edit. */
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";

/**
 * Switches an event between all-day and timed, for the new-event popup and the event popover
 * alike (see EventDatesFields). The days are kept either way, a timed event being able to span
 * several of them, and so is an end time the event already holds.
 */
export function withAllDay(draft: EventDraft, allDay: boolean): EventDraft {
    if (allDay) {
        return { ...draft, startTime: null, endTime: null };
    }

    return { ...draft, startTime: DEFAULT_START_TIME, endTime: draft.endTime ?? DEFAULT_END_TIME };
}

/**
 * Makes the end date say the day an event actually ends on, so the date fields never contradict
 * how the calendar draws it (see buildEvent in event_builder.ts):
 *
 * - A timed event whose end falls before its start ends on the first day the end time comes after
 *   the start: the start day itself, or the next day for an end time before the start time.
 * - An all-day event whose end date is before its start date lasts a single day.
 * - An end date equal to the start date is emptied, an empty end date meaning the event ends on the
 *   day it starts.
 *
 * Returns the event unchanged where its end date is already right.
 */
export function normalizeEventDates(event: EventDraft): EventDraft {
    const { startDate, startTime, endTime } = event;
    let endDate = event.endDate || null;

    if (startTime && endTime) {
        // ISO dates and 24-hour times compare correctly as strings.
        if (`${endDate ?? startDate}T${endTime}` < `${startDate}T${startTime}`) {
            endDate = endTime < startTime ? addDays(startDate, 1) : startDate;
        }
    } else if (endDate && endDate < startDate) {
        endDate = null;
    }

    if (endDate === startDate) {
        endDate = null;
    }

    return endDate === (event.endDate || null) ? event : { ...event, endDate };
}

/**
 * Moves an event to a new start date or start time, keeping how long it lasts, as calendar apps do:
 * the end moves by as much as the start, across midnight where it has to. Only an edit of the end
 * itself changes the duration.
 */
export function withStart(event: EventDraft, start: { startDate?: string; startTime?: string }): EventDraft {
    const current = normalizeEventDates(event);
    const next = { ...current, ...start };
    const duration = getTimedDurationMinutes(current);

    if (duration !== null && next.startTime) {
        const [ hours, minutes ] = next.startTime.split(":").map(Number);
        const endMinute = hours * 60 + minutes + duration;
        const endOfDay = endMinute % (24 * 60);
        const endDay = Math.floor(endMinute / (24 * 60));
        // Back on the start day: an end date the event had is cleared, a missing one stays missing.
        next.endDate = endDay > 0 ? addDays(next.startDate, endDay) : (current.endDate ? null : current.endDate);
        next.endTime = `${pad(Math.floor(endOfDay / 60))}:${pad(endOfDay % 60)}`;
    } else if (current.endDate) {
        next.endDate = addDays(current.endDate, daysBetween(current.startDate, next.startDate));
    }

    return normalizeEventDates(next);
}

/** A point in viewport coordinates — where a click or a drag's end fell, anchoring a popover
 *  beside it where nothing better can be found on the grid (see the anchor helpers). */
export interface AnchorPoint {
    x: number;
    y: number;
}

/**
 * Which event the view's popovers stand for: the note of a chip clicked, held by the event
 * popover, or a range just dragged out whose note is yet to be, held by the ghost (see
 * {@link EventDraft}).
 *
 * Owned by the calendar view rather than by either popover, because each is only one of the ways
 * in, and state a popover kept to itself could not be set from the code that hands selections
 * over — a committed ghost becomes the event popover's note, at the ghost's own anchor.
 */
export type CalendarSelection =
    | { noteId: string; anchor: AnchorPoint | null }
    | { draft: EventDraft; anchor: AnchorPoint | null };

/**
 * The piece of the grid a popover is stood beside, narrowed to what can be stood beside at all.
 *
 * A popover stands to one side of its anchor, which asks that there be a side. An event running the
 * length of a week — or a range dragged across one — is drawn as a piece as wide as the grid, and
 * the far edge of that is nowhere near the press that opened the popover: the card lands at the
 * other end of the month, which is how a popover comes to appear over the note tree. Where the grid
 * is as wide as the window, neither side has room for the card, so `Popover` shifts it into the
 * viewport on top of the event.
 *
 * So a piece wider than the card that stands beside it is narrowed to the press within it: the
 * popover appears where the eye already is, with the grid's own room on either side of it. Where
 * nothing named a point — a popover re-anchored rather than pressed for (see followLink) — the
 * piece is narrowed to the edge the card stands away from, which is the start of the span.
 */
export function narrowAnchorRect(rect: DOMRect, point: AnchorPoint | null): DOMRect {
    if (rect.width <= MAX_ANCHOR_WIDTH) {
        return rect;
    }

    const x = point
        ? Math.min(Math.max(point.x, rect.left), rect.right)
        : (glob.isRtl ? rect.right : rect.left);

    // The row's own height is kept: the card is aligned with the piece it belongs to rather than
    // with the height of the press, which is where the eye is looking either way.
    return new DOMRect(x, rect.top, 0, rect.height);
}

/** How wide a piece may be and still be stood beside: the width of the widest card the calendar
 *  anchors — the event popover's 480px, the ghost's own being narrower (see their CSS). The
 *  popover's full width rather than the lesser one a narrow window leaves it: a piece that wide on
 *  a window that narrow fills it, and the card is then placed by the viewport whatever anchor it is
 *  handed. */
const MAX_ANCHOR_WIDTH = 480;

/** Adds days to an ISO date, counted in calendar days so a daylight saving change cannot shift it. */
function addDays(isoDate: string, days: number) {
    const [ year, month, day ] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
    return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000);
}

function pad(value: number) {
    return String(value).padStart(2, "0");
}
