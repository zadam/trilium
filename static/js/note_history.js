let globalHistoryItems = null;

function showCurrentNoteHistory() {
    showNoteHistoryDialog(globalCurrentNote.detail.note_id);
}

function showNoteHistoryDialog(noteId, noteHistoryId) {
    $("#noteHistoryDialog").dialog({
        modal: true,
        width: 800,
        height: 700
    });

    $("#noteHistoryList").empty();
    $("#noteHistoryContent").empty();

    $.ajax({
        url: baseApiUrl + 'notes-history/' + noteId,
        type: 'GET',
        success: result => {
            globalHistoryItems = result;

            for (const row of result) {
                const dateModified = getDateFromTS(row.date_modified);

                $("#noteHistoryList").append($('<option>', {
                    value: row.id,
                    text: formatDateTime(dateModified)
                }));
            }

            if (result.length > 0) {
                if (!noteHistoryId) {
                    noteHistoryId = $("#noteHistoryList option:first").val();
                }

                $("#noteHistoryList").val(noteHistoryId).trigger('change');
            }
        },
        error: () => alert("Error getting note history.")
    });
}

$(document).bind('keydown', 'alt+h', showCurrentNoteHistory);

$("#noteHistoryList").on('change', () => {
    const optVal = $("#noteHistoryList").find(":selected").val();
    const historyItem = globalHistoryItems.find(r => r.id == optVal); // non-strict comparison is important here!!!s

    $("#noteHistoryTitle").html(historyItem.note_title);
    $("#noteHistoryContent").html(historyItem.note_text);
});