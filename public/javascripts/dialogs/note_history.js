"use strict";

const noteHistory = (function() {
    const dialogEl = $("#note-history-dialog");
    const listEl = $("#note-history-list");
    const contentEl = $("#note-history-content");
    const titleEl = $("#note-history-title");

    let historyItems = [];

    async function showCurrentNoteHistory() {
        await showNoteHistoryDialog(noteEditor.getCurrentNoteId());
    }

    async function showNoteHistoryDialog(noteId, noteHistoryId) {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        listEl.empty();
        contentEl.empty();

        historyItems = await $.ajax({
            url: baseApiUrl + 'notes-history/' + noteId,
            type: 'GET',
            error: () => showError("Error getting note history.")
        });

        for (const item of historyItems) {
            const dateModified = getDateFromTS(item.date_modified_to);

            $("#note-history-list").append($('<option>', {
                value: item.note_history_id,
                text: formatDateTime(dateModified)
            }));
        }

        if (historyItems.length > 0) {
            if (!noteHistoryId) {
                noteHistoryId = listEl.find("option:first").val();
            }

            listEl.val(noteHistoryId).trigger('change');
        }
    }

    $(document).bind('keydown', 'alt+h', showCurrentNoteHistory);

    listEl.on('change', () => {
        const optVal = listEl.find(":selected").val();

        const historyItem = historyItems.find(r => r.note_history_id === optVal);

        titleEl.html(historyItem.note_title);
        contentEl.html(historyItem.note_text);
    });

    $(document).on('click', "a[action='note-history']", event => {
        const linkEl = $(event.target);
        const noteId = linkEl.attr('note-path');
        const noteHistoryId = linkEl.attr('note-history-id');

        showNoteHistoryDialog(noteId, noteHistoryId);

        return false;
    });

    return {
        showCurrentNoteHistory
    };
})();