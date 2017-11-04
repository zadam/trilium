const jumpToNote = (function() {
    const dialogEl = $("#jump-to-note-dialog");
    const autoCompleteEl = $("#jump-to-note-autocomplete");
    const formEl = $("#jump-to-note-form");

    function showDialog() {
        autoCompleteEl.val('');

        dialogEl.dialog({
            modal: true,
            width: 800
        });

        autoCompleteEl.autocomplete({
            source: getAutocompleteItems(glob.allNoteIds),
            minLength: 0
        });
    }

    $(document).bind('keydown', 'alt+j', showDialog);

    formEl.submit(() => {
        const val = autoCompleteEl.val();
        const noteId = getNodeIdFromLabel(val);

        if (noteId) {
            getNodeByKey(noteId).setActive();

            dialogEl.dialog('close');
        }

        return false;
    });

    return {
        showDialog
    };
})();