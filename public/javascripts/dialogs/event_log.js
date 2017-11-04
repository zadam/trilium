const eventLog = (function() {
    const dialogEl = $("#event-log-dialog");
    const listEl = $("#event-log-list");

    async function showDialog() {
        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        const result = await $.ajax({
            url: baseApiUrl + 'event-log',
            type: 'GET',
            error: () => error("Error getting event log.")
        });

        listEl.html('');

        for (const event of result) {
            const dateTime = formatDateTime(getDateFromTS(event.date_added));

            if (event.note_id) {
                const noteLink = $("<a>", {
                    href: 'app#' + event.note_id,
                    text: getFullName(event.note_id)
                }).prop('outerHTML');

                event.comment = event.comment.replace('<note>', noteLink);
            }

            const eventEl = $('<li>').html(dateTime + " - " + event.comment);

            listEl.append(eventEl);
        }
    }

    $(document).on('click', '#event-log-dialog a', e => {
        goToInternalNote(e, () => {
            dialogEl.dialog('close');
        });
    });

    return {
        showDialog
    };
})();