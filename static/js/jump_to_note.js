$(document).bind('keydown', 'alt+j', () => {
    $("#jumpToNoteAutocomplete").val('');

    $("#jumpToNoteDialog").dialog({
        modal: true,
        width: 500
    });

    $("#jumpToNoteAutocomplete").autocomplete({
        source: getAutocompleteItems(globalAllNoteIds),
        minLength: 0
    });
});

$("#jumpToNoteForm").submit(() => {
    const val = $("#jumpToNoteAutocomplete").val();
    const noteId = getNodeIdFromLabel(val);

    if (noteId) {
        getNodeByKey(noteId).setActive();

        $("#jumpToNoteDialog").dialog('close');
    }

    return false;
});