$(document).bind('keydown', 'alt+r', function() {
    $("#recentChangesDialog").dialog({
        modal: true,
        width: 400,
        height: 700
    });

    $.ajax({
        url: baseApiUrl + 'recent-changes/',
        type: 'GET',
        success: function (result) {
            const groupedByDate = {};

            for (const row of result) {
                if (row.encryption > 0) {
                    if (isEncryptionAvailable()) {
                        row.note_title = decryptString(row.note_title);
                    }
                    else {
                        row.note_title = "[encrypted]";
                    }
                }

                const dateModified = getDateFromTS(row.date_modified);
                const formattedDate = formatDate(dateModified);

                if (!groupedByDate[formattedDate]) {
                    groupedByDate[formattedDate] = [];
                }

                groupedByDate[formattedDate].push(row);
            }

            const sortedDates = Object.keys(groupedByDate);
            sortedDates.sort();
            sortedDates.reverse();

            for (const formattedDay of sortedDates) {
                const changesListEl = $('<ul>');

                const dayEl = $('<div>').append($('<b>').html(formattedDay)).append(changesListEl);

                for (const dayChanges of groupedByDate[formattedDay]) {
                    const formattedTime = formatTime(getDateFromTS(dayChanges.date_modified));

                    const noteLink = $("<a>", {
                       href: 'app#' + dayChanges.note_id,
                       text: dayChanges.note_title
                    });

                    changesListEl.append($('<li>').append(formattedTime + ' - ').append(noteLink));
                }

                $("#recentChangesDialog").append(dayEl);
            }
        },
        error: () => alert("Error getting recent changes.")
    });
});

$(document).on('click', '#recentChangesDialog a', function(e) {
    goToInternalNote(e, () => {
        $("#recentChangesDialog").dialog('close');
    });
});