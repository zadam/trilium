import CollapsibleWidget from "../collapsible_widget.js";
import libraryLoader from "../../services/library_loader.js";
import utils from "../../services/utils.js";
import dateNoteService from "../../services/date_notes.js";
import server from "../../services/server.js";
import appContext from "../../services/app_context.js";

const TPL = `
<div class="calendar-widget">
  <div class="calendar-header">
    <button class="calendar-btn bx bx-left-arrow-alt" data-calendar-toggle="previous"></button>

    <div class="calendar-header-label" data-calendar-label="month">
      March 2017
    </div>

    <button class="calendar-btn bx bx-right-arrow-alt" data-calendar-toggle="next"></button>
  </div>

  <div class="calendar-week">
    <span>Mon</span> <span>Tue</span><span>Wed</span> <span>Thu</span> <span>Fri</span> <span>Sat</span> <span>Sun</span>
  </div>
  <div class="calendar-body" data-calendar-area="month"></div>
</div>
`;

export default class CalendarWidget extends CollapsibleWidget {
    get widgetTitle() { return "Calendar"; }

    isEnabled() {
        return super.isEnabled()
            && this.note.hasOwnedLabel("dateNote");
    }

    async doRenderBody() {
        await libraryLoader.requireLibrary(libraryLoader.CALENDAR_WIDGET);

        this.$body.html(TPL);

        this.$month = this.$body.find('[data-calendar-area="month"]');
        this.$next = this.$body.find('[data-calendar-toggle="next"]');
        this.$previous = this.$body.find('[data-calendar-toggle="previous"]');
        this.$label = this.$body.find('[data-calendar-label="month"]');

        this.$next.on('click', () => {
            this.date.setMonth(this.date.getMonth() + 1);
            this.createMonth();
        });

        this.$previous.on('click', () => {
            this.date.setMonth(this.date.getMonth() - 1);
            this.createMonth();
        });

        this.$body.on('click', '.calendar-date', async ev => {
            const date = $(ev.target).closest('.calendar-date').attr('data-calendar-date');

            const note = await dateNoteService.getDateNote(date);

            if (note) {
                appContext.tabManager.getActiveTabContext().setNote(note.noteId);
            }
            else {
                alert("Cannot find day note");
            }
        });
    }

    async refreshWithNote(note) {
        this.init(this.$body, note.getOwnedLabelValue("dateNote"));
    }

    init($el, activeDate) {
        this.activeDate = new Date(activeDate + "T12:00:00"); // attaching time fixes local timezone handling
        this.todaysDate = new Date();
        this.date = new Date(this.activeDate.getTime());
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
        return a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
    }

    async createMonth() {
        const month = utils.formatDateISO(this.date).substr(0, 7);
        const dateNotesForMonth = await server.get('date-notes/notes-for-month/' + month);

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