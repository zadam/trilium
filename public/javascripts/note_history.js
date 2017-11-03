let globalHistoryItems = null;

function showCurrentNoteHistory() {
    showNoteHistoryDialog(globalCurrentNote.detail.note_id);
}

function showNoteHistoryDialog(noteId, noteHistoryId) {
    $("#note-history-dialog").dialog({
        modal: true,
        width: 800,
        height: 700
    });

    $("#note-history-list").empty();
    $("#note-history-content").empty();

    $.ajax({
        url: baseApiUrl + 'notes-history/' + noteId,
        type: 'GET',
        success: result => {
            globalHistoryItems = result;

            for (const row of result) {
                const dateModified = getDateFromTS(row.date_modified_to);

                $("#note-history-list").append($('<option>', {
                    value: row.note_history_id,
                    text: formatDateTime(dateModified)
                }));
            }

            if (result.length > 0) {
                if (!noteHistoryId) {
                    noteHistoryId = $("#note-history-list option:first").val();
                }

                $("#note-history-list").val(noteHistoryId).trigger('change');
            }
        },
        error: () => alert("Error getting note history.")
    });
}

$(document).bind('keydown', 'alt+h', showCurrentNoteHistory);

$("#note-history-list").on('change', () => {
    const optVal = $("#note-history-list").find(":selected").val();

    const historyItem = globalHistoryItems.find(r => r.note_history_id === optVal);

    let noteTitle = historyItem.note_title;
    let noteText = historyItem.note_text;

    if (historyItem.encryption > 0) {
        noteTitle = decryptString(noteTitle);
        noteText = decryptString(noteText);
    }

    $("#note-history-title").html(noteTitle);
    $("#note-history-content").html(noteText);
});