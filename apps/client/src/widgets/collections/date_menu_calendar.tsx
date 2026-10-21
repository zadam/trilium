import "../launch_bar/CalendarWidget.css";
import "./date_menu_calendar.css";

import { dayjs } from "@triliumnext/commons";
import { useState } from "preact/hooks";

import Calendar from "../launch_bar/Calendar";
import { AdjustDateButton, MONTHS } from "../launch_bar/CalendarWidget";
import { useMenu } from "../react/menu_context";

interface DateMenuCalendarProps {
    /** The date the items hold, as `YYYY-MM-DD`, or `undefined` where they hold none or disagree. */
    value: string | undefined;
    onPick(date: string): void;
}

/**
 * A month grid for a menu row, opening on the month of {@link DateMenuCalendarProps.value}. Picking
 * a day closes the menu; the arrows change the month and leave it open.
 */
export default function DateMenuCalendar({ value, onPick }: DateMenuCalendarProps) {
    const menu = useMenu();
    const stored = value ? dayjs(`${value}T12:00:00`) : null;
    const activeDate = stored?.isValid() ? stored : null;
    const [ month, setMonth ] = useState(() => (activeDate ?? dayjs()).startOf("month"));

    return (
        <div className="calendar-dropdown-widget date-menu-calendar">
            <div className="calendar-header">
                <AdjustDateButton date={month} setDate={setMonth} direction="prev" unit="month" />
                <span className="date-menu-calendar-title">
                    {MONTHS[month.month()]} {month.year()}
                </span>
                <AdjustDateButton date={month} setDate={setMonth} direction="next" unit="month" />
            </div>
            <Calendar
                date={month}
                todaysDate={dayjs()}
                activeDate={activeDate}
                weekNotes={[]}
                markDayNotes={false}
                onDateClicked={(date) => {
                    onPick(date);
                    menu.close();
                }}
            />
        </div>
    );
}
