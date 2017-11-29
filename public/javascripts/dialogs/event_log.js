"use strict";

const eventLog = (function() {
    const dialogEl = $("#event-log-dialog");
    const listEl = $("#event-log-list");

    async function showDialog() {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        const result = await server.get('event-log');

        listEl.html('');

        for (const event of result) {
            const dateTime = formatDateTime(getDateFromTS(event.date_added));

            if (event.note_id) {
                const noteLink = link.createNoteLink(event.note_id).prop('outerHTML');

                event.comment = event.comment.replace('<note>', noteLink);
            }

            const eventEl = $('<li>').html(dateTime + " - " + event.comment);

            listEl.append(eventEl);
        }
    }

    return {
        showDialog
    };
})();