"use strict";

const addLink = (function() {
    const dialogEl = $("#insert-link-dialog");
    const formEl = $("#insert-link-form");
    const autoCompleteEl = $("#note-autocomplete");
    const noteDetailEl = $('#note-detail');
    const linkTitleEl = $("#link-title");

    function showDialog() {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: 500
        });

        autoCompleteEl.val('').focus();
        linkTitleEl.val('');

        function setDefaultLinkTitle(noteId) {
            const noteTitle = noteTree.getNoteTitle(noteId);

            linkTitleEl.val(noteTitle);
        }

        autoCompleteEl.autocomplete({
            source: noteTree.getAutocompleteItems(),
            minLength: 0,
            change: () => {
                const val = autoCompleteEl.val();
                const notePath = link.getNodePathFromLabel(val);
                const noteId = treeUtils.getNoteIdFromNotePath(notePath);

                if (noteId) {
                    setDefaultLinkTitle(noteId);
                }
            },
            // this is called when user goes through autocomplete list with keyboard
            // at this point the item isn't selected yet so we use supplied ui.item to see WHERE the cursor is
            focus: (event, ui) => {
                const notePath = link.getNodePathFromLabel(ui.item.value);
                const noteId = treeUtils.getNoteIdFromNotePath(notePath);

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

            link.addLinkToEditor(linkTitle, '#' + notePath);
        }

        return false;
    });

    $(document).bind('keydown', 'ctrl+l', e => {
        showDialog();

        e.preventDefault();
    });

    return {
        showDialog
    };
})();