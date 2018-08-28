import linkService from '../services/link.js';
import utils from '../services/utils.js';
import server from '../services/server.js';

const $dialog = $("#event-log-dialog");
const $list = $("#event-log-list");

async function showDialog() {
    glob.activeDialog = $dialog;

    $dialog.dialog({
        modal: true,
        width: 800,
        height: 700
    });

    const result = await server.get('event-log');

    $list.empty();

    for (const event of result) {
        const dateTime = utils.formatDateTime(utils.parseDate(event.dateCreated));

        if (event.noteId) {
            const noteLink = await linkService.createNoteLink(event.noteId).prop('outerHTML');

            event.comment = event.comment.replace('<note>', noteLink);
        }

        const eventEl = $('<li>').html(dateTime + " - " + event.comment);

        $list.append(eventEl);
    }
}

export default {
    showDialog
};
