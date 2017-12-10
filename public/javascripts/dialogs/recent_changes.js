"use strict";

const recentChanges = (function() {
    const dialogEl = $("#recent-changes-dialog");

    async function showDialog() {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        const result = await server.get('recent-changes/');

        dialogEl.html('');

        const groupedByDate = groupByDate(result);

        for (const [dateDay, dayChanges] of groupedByDate) {
            const changesListEl = $('<ul>');

            const dayEl = $('<div>').append($('<b>').html(formatDate(dateDay))).append(changesListEl);

            for (const change of dayChanges) {
                const formattedTime = formatTime(parseDate(change.date_modified_to));

                const revLink = $("<a>", {
                    href: 'javascript:',
                    text: 'rev'
                }).attr('action', 'note-history')
                    .attr('note-path', change.note_id)
                    .attr('note-history-id', change.note_history_id);

                let noteLink;

                if (change.current_is_deleted) {
                    noteLink = change.current_note_title;
                }
                else {
                    noteLink = link.createNoteLink(change.note_id, change.note_title);
                }

                changesListEl.append($('<li>')
                    .append(formattedTime + ' - ')
                    .append(noteLink)
                    .append(' (').append(revLink).append(')'));
            }

            dialogEl.append(dayEl);
        }
    }

    function groupByDate(result) {
        const groupedByDate = new Map();
        const dayCache = {};

        for (const row of result) {
            let dateDay = parseDate(row.date_modified_to);
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