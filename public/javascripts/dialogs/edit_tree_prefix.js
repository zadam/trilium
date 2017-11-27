"use strict";

const editTreePrefix = (function() {
    const dialogEl = $("#edit-tree-prefix-dialog");
    const formEl = $("#edit-tree-prefix-form");
    const treePrefixInputEl = $("#tree-prefix-input");
    const noteTitleEl = $('#tree-prefix-note-title');

    async function showDialog() {
        glob.activeDialog = dialogEl;

        await dialogEl.dialog({
            modal: true,
            width: 800
        });

        const currentNode = noteTree.getCurrentNode();

        treePrefixInputEl.val(currentNode.data.prefix).focus();

        const noteTitle = noteTree.getNoteTitle(currentNode.data.note_id);

        noteTitleEl.html(noteTitle);
    }

    formEl.submit(() => {
        const prefix = treePrefixInputEl.val();
        const currentNode = noteTree.getCurrentNode();
        const noteTreeId = currentNode.data.note_tree_id;

        $.ajax({
            url: baseApiUrl + 'tree/' + noteTreeId + '/setPrefix',
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                prefix: prefix
            }),
            success: () => {
                currentNode.data.prefix = prefix;

                const noteTitle = noteTree.getNoteTitle(currentNode.data.note_id);

                const title = (prefix ? (prefix + " - ") : "") + noteTitle;

                currentNode.setTitle(title);
            },
            error: () => showError("Error setting prefix.")
        });

        dialogEl.dialog("close");

        return false;
    });

    return {
        showDialog
    };
})();