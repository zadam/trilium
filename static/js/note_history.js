let globalHistoryItems = null;

$(document).bind('keydown', 'alt+h', function() {
    $("#noteHistoryDialog").dialog({
        modal: true,
        width: 800,
        height: 700
    });

    $("#noteHistoryList").empty();
    $("#noteHistoryContent").empty();

    $.ajax({
        url: baseUrl + 'notes-history/' + globalCurrentNote.detail.note_id,
        type: 'GET',
        success: function (result) {
            globalHistoryItems = result;

            for (const row of result) {
                const dateModified = new Date(row.date_modified * 1000);

                $("#noteHistoryList").append($('<option>', {
                    value: row.id,
                    text: formatDate(dateModified)
                }));
            }

            if (result.length > 0) {
                const firstOptionValue = $("#noteHistoryList option:first").val();

                $("#noteHistoryList").val(firstOptionValue).trigger('change');
            }
        },
        error: () => alert("Error getting note history.")
    });
});

$("#noteHistoryList").on('change', () => {
    const optVal = $("#noteHistoryList").find(":selected").val();
    const historyItem = globalHistoryItems.find(r => r.id == optVal); // non-strict comparison is important here!!!s

    $("#noteHistoryTitle").html(historyItem.note_title);
    $("#noteHistoryContent").html(historyItem.note_text);
});