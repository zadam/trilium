const noteHistory = (function() {
    const dialogEl = $("#note-history-dialog");
    const listEl = $("#note-history-list");
    const contentEl = $("#note-history-content");
    const titleEl = $("#note-history-title");

    let historyItems = [];

    async function showCurrentNoteHistory() {
        await showNoteHistoryDialog(glob.currentNote.detail.note_id);
    }

    // weird hack because browser doesn't like we're returning promise and displays promise page
    function showNoteHistoryDialogNotAsync(noteId, noteHistoryId) {
        showNoteHistoryDialog(noteId, noteHistoryId);
    }

    async function showNoteHistoryDialog(noteId, noteHistoryId) {
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
            error: () => error("Error getting note history.")
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

        let noteTitle = historyItem.note_title;
        let noteText = historyItem.note_text;

        if (historyItem.encryption > 0) {
            noteTitle = decryptString(noteTitle);
            noteText = decryptString(noteText);
        }

        titleEl.html(noteTitle);
        contentEl.html(noteText);
    });

    return {
        showCurrentNoteHistory,
        showNoteHistoryDialog,
        showNoteHistoryDialogNotAsync
    };
})();