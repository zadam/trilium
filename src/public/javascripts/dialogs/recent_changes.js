"use strict";

const recentChanges = (function() {
    const $dialog = $("#recent-changes-dialog");

    async function showDialog() {
        glob.activeDialog = $dialog;

        $dialog.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        const result = await server.get('recent-changes/');

        $dialog.html('');

        const groupedByDate = groupByDate(result);

        for (const [dateDay, dayChanges] of groupedByDate) {
            const changesListEl = $('<ul>');

            const dayEl = $('<div>').append($('<b>').html(formatDate(dateDay))).append(changesListEl);

            for (const change of dayChanges) {
                const formattedTime = formatTime(parseDate(change.dateModifiedTo));

                const revLink = $("<a>", {
                    href: 'javascript:',
                    text: 'rev'
                }).attr('action', 'note-history')
                    .attr('note-path', change.noteId)
                    .attr('note-history-id', change.noteRevisionId);

                let noteLink;

                if (change.current_isDeleted) {
                    noteLink = change.current_title;
                }
                else {
                    noteLink = link.createNoteLink(change.noteId, change.title);
                }

                changesListEl.append($('<li>')
                    .append(formattedTime + ' - ')
                    .append(noteLink)
                    .append(' (').append(revLink).append(')'));
            }

            $dialog.append(dayEl);
        }
    }

    function groupByDate(result) {
        const groupedByDate = new Map();
        const dayCache = {};

        for (const row of result) {
            let dateDay = parseDate(row.dateModifiedTo);
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

    $(document).bind('keydown', 'alt+r', showDialog);

    return {
        showDialog
    };
})();