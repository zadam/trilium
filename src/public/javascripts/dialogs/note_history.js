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

    async function showNoteHistoryDialog(noteId, noteRevisionId) {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 800,
            height: 700
        });

        listEl.empty();
        contentEl.empty();

        historyItems = await server.get('notes-history/' + noteId);

        for (const item of historyItems) {
            const dateModified = parseDate(item.dateModifiedFrom);

            listEl.append($('<option>', {
                value: item.noteRevisionId,
                text: formatDateTime(dateModified)
            }));
        }

        if (historyItems.length > 0) {
            if (!noteRevisionId) {
                noteRevisionId = listEl.find("option:first").val();
            }

            listEl.val(noteRevisionId).trigger('change');
        }
        else {
            titleEl.text("No history for this note yet...");
        }
    }

    $(document).bind('keydown', 'alt+h', e => {
        showCurrentNoteHistory();

        e.preventDefault();
    });

    listEl.on('change', () => {
        const optVal = listEl.find(":selected").val();

        const historyItem = historyItems.find(r => r.noteRevisionId === optVal);

        titleEl.html(historyItem.title);
        contentEl.html(historyItem.content);
    });

    $(document).on('click', "a[action='note-history']", event => {
        const linkEl = $(event.target);
        const noteId = linkEl.attr('note-path');
        const noteRevisionId = linkEl.attr('note-history-id');

        showNoteHistoryDialog(noteId, noteRevisionId);

        return false;
    });

    return {
        showCurrentNoteHistory
    };
})();