"use strict";

const eventLog = (function() {
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

        $list.html('');

        for (const event of result) {
            const dateTime = formatDateTime(parseDate(event.dateAdded));

            if (event.noteId) {
                const noteLink = link.createNoteLink(event.noteId).prop('outerHTML');

                event.comment = event.comment.replace('<note>', noteLink);
            }

            const eventEl = $('<li>').html(dateTime + " - " + event.comment);

            $list.append(eventEl);
        }
    }

    return {
        showDialog
    };
})();