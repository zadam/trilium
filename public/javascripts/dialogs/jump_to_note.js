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

    function getSelectedNotePath() {
        const val = autoCompleteEl.val();
        return link.getNodePathFromLabel(val);
    }

    function getSelectedNoteId() {
        const notePath = getSelectedNotePath();
        return treeUtils.getNoteIdFromNotePath(notePath);
    }

    function goToNote() {
        const notePath = getSelectedNotePath();

        if (notePath) {
            noteTree.activateNode(notePath);

            dialogEl.dialog('close');
        }
    }

    $(document).bind('keydown', 'ctrl+j', e => {
        showDialog();

        e.preventDefault();
    });

    formEl.submit(() => {
        const action = dialogEl.find("button:focus").val();

        goToNote();

        return false;
    });

    return {
        showDialog
    };
})();