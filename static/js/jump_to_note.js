$(document).bind('keydown', 'alt+j', () => {
    $("#jump-to-note-autocomplete").val('');

    $("#jump-to-note-dialog").dialog({
        modal: true,
        width: 500
    });

    $("#jump-to-note-autocomplete").autocomplete({
        source: getAutocompleteItems(globalAllNoteIds),
        minLength: 0
    });
});

$("#jump-to-note-form").submit(() => {
    const val = $("#jump-to-note-autocomplete").val();
    const noteId = getNodeIdFromLabel(val);

    if (noteId) {
        getNodeByKey(noteId).setActive();

        $("#jump-to-note-dialog").dialog('close');
    }

    return false;
});