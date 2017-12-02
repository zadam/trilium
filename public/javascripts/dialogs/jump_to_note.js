"use strict";

const jumpToNote = (function() {
    const dialogEl = $("#jump-to-note-dialog");
    const autoCompleteEl = $("#jump-to-note-autocomplete");
    const formEl = $("#jump-to-note-form");
    const noteDetailEl = $('#note-detail');

    async function showDialog() {
        noteDetailEl.summernote('editor.saveRange');

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

    $(document).bind('keydown', 'alt+j', showDialog);

    formEl.submit(() => {
        const action = dialogEl.find("button:focus").val();

        if (!action || action === 'jump') {
            goToNote();
        }
        else if (action === 'add-link') {
            const notePath = getSelectedNotePath();

            if (notePath) {
                dialogEl.dialog("close");

                noteDetailEl.summernote('editor.restoreRange');

                const noteId = treeUtils.getNoteIdFromNotePath(notePath);

                noteDetailEl.summernote('createLink', {
                    text: noteTree.getNoteTitle(noteId),
                    url: 'app#' + notePath,
                    isNewWindow: true
                });
            }
        }
        else if (action === 'add-current-as-child') {
            treeChanges.cloneNoteTo(noteEditor.getCurrentNoteId(), getSelectedNoteId());

            dialogEl.dialog("close");
        }
        else if (action === 'add-selected-as-child') {
            treeChanges.cloneNoteTo(getSelectedNoteId(), noteEditor.getCurrentNoteId());

            dialogEl.dialog("close");
        }
        else {
            messaging.logError("Unknown action=" + action);
        }

        return false;
    });

    return {
        showDialog
    };
})();