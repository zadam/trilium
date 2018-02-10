"use strict";

const editTreePrefix = (function() {
    const $dialog = $("#edit-tree-prefix-dialog");
    const $form = $("#edit-tree-prefix-form");
    const $treePrefixInput = $("#tree-prefix-input");
    const $noteTitle = $('#tree-prefix-note-title');

    let noteTreeId;

    async function showDialog() {
        glob.activeDialog = $dialog;

        await $dialog.dialog({
            modal: true,
            width: 500
        });

        const currentNode = noteTree.getCurrentNode();

        noteTreeId = currentNode.data.noteTreeId;

        $treePrefixInput.val(currentNode.data.prefix).focus();

        const noteTitle = noteTree.getNoteTitle(currentNode.data.noteId);

        $noteTitle.html(noteTitle);
    }

    $form.submit(() => {
        const prefix = $treePrefixInput.val();

        server.put('tree/' + noteTreeId + '/set-prefix', {
            prefix: prefix
        }).then(() => noteTree.setPrefix(noteTreeId, prefix));

        $dialog.dialog("close");

        return false;
    });

    return {
        showDialog
    };
})();