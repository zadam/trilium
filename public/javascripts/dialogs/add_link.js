"use strict";

const addLink = (function() {
    const dialogEl = $("#insert-link-dialog");
    const formEl = $("#insert-link-form");
    const autoCompleteEl = $("#note-autocomplete");
    const noteDetailEl = $('#note-detail');
    const linkTitleEl = $("#link-title");

    function showDialog() {
        glob.activeDialog = dialogEl;

        noteDetailEl.summernote('editor.saveRange');

        dialogEl.dialog({
            modal: true,
            width: 500
        });

        autoCompleteEl.val('').focus();
        linkTitleEl.val('');

        function setDefaultLinkTitle(noteId) {
            const noteTitle = treeUtils.getNoteTitle(noteId);

            linkTitleEl.val(noteTitle);
        }

        autoCompleteEl.autocomplete({
            source: noteTree.getAutocompleteItems(),
            minLength: 0,
            change: () => {
                const val = autoCompleteEl.val();
                const noteId = link.getNodePathFromLabel(val);

                if (noteId) {
                    setDefaultLinkTitle(noteId);
                }
            },
            // this is called when user goes through autocomplete list with keyboard
            // at this point the item isn't selected yet so we use supplied ui.item to see WHERE the cursor is
            focus: (event, ui) => {
                const noteId = link.getNodePathFromLabel(ui.item.value);

                setDefaultLinkTitle(noteId);
            }
        });
    }

    formEl.submit(() => {
        const value = autoCompleteEl.val();

        const notePath = link.getNodePathFromLabel(value);

        if (notePath) {
            const linkTitle = linkTitleEl.val();

            dialogEl.dialog("close");

            noteDetailEl.summernote('editor.restoreRange');

            noteDetailEl.summernote('createLink', {
                text: linkTitle,
                url: 'app#' + notePath,
                isNewWindow: true
            });
        }

        return false;
    });

    $(document).bind('keydown', 'alt+l', showDialog);

    return {
        showDialog
    };
})();