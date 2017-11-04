async function showEventLog() {
    $("#event-log-dialog").dialog({
        modal: true,
        width: 800,
        height: 700
    });

    const result = await $.ajax({
        url: baseApiUrl + 'event-log',
        type: 'GET',
        error: () => error("Error getting event log.")
    });

    const eventLogList = $("#event-log-list");
    eventLogList.html('');

    for (const event of result) {
        const dateTime = formatDateTime(getDateFromTS(event.date_added));

        if (event.note_id) {
            const noteLink = $("<a>", {
                href: 'app#' + event.note_id,
                text: event.note_title
            }).prop('outerHTML');

            console.log(noteLink);

            event.comment = event.comment.replace('<note>', noteLink);
        }

        const eventEl = $('<li>').html(dateTime + " - " + event.comment);


        eventLogList.append(eventEl);
    }
}

$(document).on('click', '#event-log-dialog a', e => {
    goToInternalNote(e, () => {
        $("#event-log-dialog").dialog('close');
    });
});