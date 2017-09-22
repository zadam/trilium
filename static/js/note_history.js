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
            if (result.length > 0) {
                $("#noteHistoryContent").html(result[0]["note_text"]);
            }

            for (row of result) {
                const dateModified = new Date(row['date_modified'] * 1000);
                const optionHtml = '<option value="' + row['note_id'] + '">' + formatDate(dateModified) + '</option>';

                $("#noteHistoryList").append(optionHtml);
            }
        },
        error: () => alert("Error getting note history.")
    });
});