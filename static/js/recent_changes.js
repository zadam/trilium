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

                const dateDay = getDateFromTS(row.date_modified);
                dateDay.setHours(0);
                dateDay.setMinutes(0);
                dateDay.setSeconds(0);
                dateDay.setMilliseconds(0);

                const dateDayTS = dateDay.getTime(); // we can't use dateDay as key because complex objects can't be keys

                if (!groupedByDate[dateDayTS]) {
                    groupedByDate[dateDayTS] = [];
                }

                groupedByDate[dateDayTS].push(row);
            }

            const sortedDates = Object.keys(groupedByDate);
            sortedDates.sort();
            sortedDates.reverse();

            for (const dateDayTS of sortedDates) {
                const changesListEl = $('<ul>');

                const formattedDate = formatDate(getDateFromTS(groupedByDate[dateDayTS][0].date_modified));

                const dayEl = $('<div>').append($('<b>').html(formattedDate)).append(changesListEl);

                for (const dayChanges of groupedByDate[dateDayTS]) {
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