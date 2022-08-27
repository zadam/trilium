import libraryLoader from "../../services/library_loader.js";
import utils from "../../services/utils.js";
import dateNoteService from "../../services/date_notes.js";
import server from "../../services/server.js";
import appContext from "../../services/app_context.js";
import RightDropdownButtonWidget from "./right_dropdown_button.js";
import toastService from "../../services/toast.js";

const DROPDOWN_TPL = `
<div class="calendar-dropdown-widget">
  <style>
  .calendar-dropdown-widget {
      width: 350px;
  }
  </style>

  <div class="calendar-header">
    <button class="calendar-btn bx bx-left-arrow-alt" data-calendar-toggle="previous"></button>

    <div class="calendar-header-label" data-calendar-label="month"></div>

    <button class="calendar-btn bx bx-right-arrow-alt" data-calendar-toggle="next"></button>
  </div>

  <div class="calendar-week">
    <span>Mon</span> <span>Tue</span><span>Wed</span> <span>Thu</span> <span>Fri</span> <span>Sat</span> <span>Sun</span>
  </div>
  <div class="calendar-body" data-calendar-area="month"></div>
</div>`;

export default class CalendarWidget extends RightDropdownButtonWidget {
    constructor() {
        super("bx-calendar", "Calendar", DROPDOWN_TPL);
    }

    doRender() {
        super.doRender();

        this.$month = this.$dropdownContent.find('[data-calendar-area="month"]');
        this.$next = this.$dropdownContent.find('[data-calendar-toggle="next"]');
        this.$previous = this.$dropdownContent.find('[data-calendar-toggle="previous"]');
        this.$label = this.$dropdownContent.find('[data-calendar-label="month"]');

        this.$next.on('click', () => {
            this.date.setMonth(this.date.getMonth() + 1);
            this.createMonth();
        });

        this.$previous.on('click', e => {
            this.date.setMonth(this.date.getMonth() - 1);
            this.createMonth();
        });

        this.$dropdownContent.find('.calendar-header').on("click", e => e.stopPropagation());

        this.$dropdownContent.on('click', '.calendar-date', async ev => {
            const date = $(ev.target).closest('.calendar-date').attr('data-calendar-date');

            const note = await dateNoteService.getDayNote(date);

            if (note) {
                appContext.tabManager.getActiveContext().setNote(note.noteId);
                this.hideDropdown();
            }
            else {
                toastService.showError("Cannot find day note");
            }
        });
    }

    async dropdownShown() {
        await libraryLoader.requireLibrary(libraryLoader.CALENDAR_WIDGET);

        const activeNote = appContext.tabManager.getActiveContextNote();

        this.init(activeNote?.getOwnedLabelValue("dateNote"));
    }

    init(activeDate) {
        // attaching time fixes local timezone handling
        this.activeDate = activeDate ? new Date(activeDate + "T12:00:00") : null;
        this.todaysDate = new Date();
        this.date = new Date((this.activeDate || this.todaysDate).getTime());
        this.date.setDate(1);

        this.createMonth();
    }

    createDay(dateNotesForMonth, num, day) {
        const $newDay = $('<a>')
            .addClass("calendar-date")
            .attr('data-calendar-date', utils.formatDateISO(this.date));
        const $date = $('<span>').html(num);

        // if it's the first day of the month
        if (num === 1) {
            if (day === 0) {
                $newDay.css("marginLeft", (6 * 14.28) + '%');
            } else {
                $newDay.css("marginLeft", ((day - 1) * 14.28) + '%');
            }
        }

        const dateNoteId = dateNotesForMonth[utils.formatDateISO(this.date)];

        if (dateNoteId) {
            $newDay.addClass('calendar-date-exists');
            $newDay.attr("data-note-path", dateNoteId);
        }

        if (this.isEqual(this.date, this.activeDate)) {
            $newDay.addClass('calendar-date-active');
        }

        if (this.isEqual(this.date, this.todaysDate)) {
            $newDay.addClass('calendar-date-today');
        }

        $newDay.append($date);
        return $newDay;
    }

    isEqual(a, b) {
        if (!a && b || a && !b) {
            return false;
        }

        return a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
    }

    async createMonth() {
        const month = utils.formatDateISO(this.date).substr(0, 7);
        const dateNotesForMonth = await server.get('special-notes/notes-for-month/' + month);

        this.$month.empty();

        const currentMonth = this.date.getMonth();
        while (this.date.getMonth() === currentMonth) {
            const $day = this.createDay(
                dateNotesForMonth,
                this.date.getDate(),
                this.date.getDay(),
                this.date.getFullYear()
            );

            this.$month.append($day);

            this.date.setDate(this.date.getDate() + 1);
        }
        // while loop trips over and day is at 30/31, bring it back
        this.date.setDate(1);
        this.date.setMonth(this.date.getMonth() - 1);

        this.$label.html(this.monthsAsString(this.date.getMonth()) + ' ' + this.date.getFullYear());
    }

    monthsAsString(monthIndex) {
        return [
            'January',
            'Febuary',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ][monthIndex];
    }
}
