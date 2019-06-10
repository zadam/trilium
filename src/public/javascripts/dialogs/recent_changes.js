import linkService from '../services/link.js';
import utils from '../services/utils.js';
import server from '../services/server.js';

const $dialog = $("#recent-changes-dialog");
const $content = $("#recent-changes-content");

async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    const result = await server.get('recent-changes');

    $content.empty();

    if (result.length === 0) {
        $content.append("No changes yet ...");
    }

    const groupedByDate = groupByDate(result);

    for (const [dateDay, dayChanges] of groupedByDate) {
        const changesListEl = $('<ul>');

        const dayEl = $('<div>').append($('<b>').html(utils.formatDate(dateDay))).append(changesListEl);

        for (const change of dayChanges) {
            const formattedTime = utils.formatTime(utils.parseDate(change.utcDateModifiedTo));

            let noteLink;

            if (change.current_isDeleted) {
                noteLink = change.current_title;
            }
            else {
                noteLink = await linkService.createNoteLink(change.noteId, change.title);
            }

            changesListEl.append($('<li>')
                .append(formattedTime + ' - ')
                .append(noteLink));
        }

        $content.append(dayEl);
    }
}

function groupByDate(result) {
    const groupedByDate = new Map();
    const dayCache = {};

    for (const row of result) {
        let dateDay = utils.parseDate(row.utcDateModifiedTo);
        dateDay.setHours(0);
        dateDay.setMinutes(0);
        dateDay.setSeconds(0);
        dateDay.setMilliseconds(0);

        // this stupidity is to make sure that we always use the same day object because Map uses only
        // reference equality
        if (dayCache[dateDay]) {
            dateDay = dayCache[dateDay];
        }
        else {
            dayCache[dateDay] = dateDay;
        }

        if (!groupedByDate.has(dateDay)) {
            groupedByDate.set(dateDay, []);
        }

        groupedByDate.get(dateDay).push(row);
    }
    return groupedByDate;
}

export default {
    showDialog
};