"use strict";

const jumpToNote = (function() {
    const $dialog = $("#jump-to-note-dialog");
    const $autoComplete = $("#jump-to-note-autocomplete");
    const $form = $("#jump-to-note-form");

    async function showDialog() {
        glob.activeDialog = $dialog;

        $autoComplete.val('');

        $dialog.dialog({
            modal: true,
            width: 800
        });

        await $autoComplete.autocomplete({
            source: await stopWatch("building autocomplete", noteTree.getAutocompleteItems),
            minLength: 0
        });
    }

    function getSelectedNotePath() {
        const val = $autoComplete.val();
        return link.getNodePathFromLabel(val);
    }

    function goToNote() {
        const notePath = getSelectedNotePath();

        if (notePath) {
            noteTree.activateNode(notePath);

            $dialog.dialog('close');
        }
    }

    $(document).bind('keydown', 'ctrl+j', e => {
        showDialog();

        e.preventDefault();
    });

    $form.submit(() => {
        const action = $dialog.find("button:focus").val();

        goToNote();

        return false;
    });

    return {
        showDialog
    };
})();