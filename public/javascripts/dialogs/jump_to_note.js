"use strict";

const jumpToNote = (function() {
    const dialogEl = $("#jump-to-note-dialog");
    const autoCompleteEl = $("#jump-to-note-autocomplete");
    const formEl = $("#jump-to-note-form");

    async function showDialog() {
        glob.activeDialog = dialogEl;

        autoCompleteEl.val('');

        dialogEl.dialog({
            modal: true,
            width: 800
        });

        await autoCompleteEl.autocomplete({
            source: noteTree.getAutocompleteItems(),
            minLength: 0
        });
    }

    function goToNote() {
        const val = autoCompleteEl.val();
        const notePath = link.getNodePathFromLabel(val);

        if (notePath) {
            noteTree.activateNode(notePath);

            dialogEl.dialog('close');
        }
    }

    $(document).bind('keydown', 'alt+j', showDialog);

    formEl.submit(() => {
        const action = dialogEl.find("button:focus").val();

        if (action === 'jump') {
            goToNote();
        }

        return false;
    });

    return {
        showDialog
    };
})();