import StandardWidget from "./standard_widget.js";
import libraryLoader from "../services/library_loader.js";
import utils from "../services/utils.js";
import dateNoteService from "../services/date_notes.js";
import treeService from "../services/tree.js";
import server from "../services/server.js";

const TPL = `
<div class="calendar-widget">
  <div class="calendar-header">
    <button class="calendar-btn bx bx-left-arrow-alt" data-calendar-toggle="previous"></button>

    <div class="calendar-header__label" data-calendar-label="month">
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

class CalendarWidget extends StandardWidget {
    getWidgetTitle() { return "Calendar"; }

    async isEnabled() {
        return await super.isEnabled()
            && await this.ctx.note.hasLabel("dateNote");
    }

    async doRenderBody() {
        await libraryLoader.requireLibrary(libraryLoader.CALENDAR_WIDGET);

        this.$body.html(TPL);

        this.init(this.$body, await this.ctx.note.getLabelValue("dateNote"));
    }

    init($el, activeDate) {
        this.activeDate = new Date(Date.parse(activeDate));
        this.todaysDate = new Date();
        this.date = new Date(this.activeDate.getTime());

        this.$month = $el.find('[data-calendar-area="month"]');
        this.$next = $el.find('[data-calendar-toggle="next"]');
        this.$previous = $el.find('[data-calendar-toggle="previous"]');

        this.$next.on('click', () => {
            this.clearCalendar();
            this.date.setMonth(this.date.getMonth() + 1);
            this.createMonth();
        });

        this.$previous.on('click', () => {
            this.clearCalendar();
            this.date.setMonth(this.date.getMonth() - 1);
            this.createMonth();
        });

        this.$label = $el.find('[data-calendar-label="month"]');

        this.date.setDate(1);
        this.createMonth();

        this.$body.on('click', '.calendar-date', async ev => {
            const date = $(ev.target).closest('.calendar-date').attr('data-calendar-date');

            const note = await dateNoteService.getDateNote(date);

            if (note) {
                treeService.activateNote(note.noteId);
            }
            else {
                alert("Cannot find day note");
            }
        });
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
        this.$month.append($newDay);
    }

    isEqual(a, b) {
        return a.getFullYear() === b.getFullYear()
            && a.getMonth() === b.getMonth()
            && a.getDate() === b.getDate();
    }

    async createMonth() {
        const month = utils.formatDateISO(this.date).substr(0, 7);
        const dateNotesForMonth = await server.get('date-notes/notes-for-month/' + month);

        const currentMonth = this.date.getMonth();
        while (this.date.getMonth() === currentMonth) {
            this.createDay(
                dateNotesForMonth,
                this.date.getDate(),
                this.date.getDay(),
                this.date.getFullYear()
            );
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

    clearCalendar() {
        this.$month.html('');
    }
}

export default CalendarWidget;