"use strict";

const editTreePrefix = (function() {
    const dialogEl = $("#edit-tree-prefix-dialog");
    const formEl = $("#edit-tree-prefix-form");
    const treePrefixInputEl = $("#tree-prefix-input");
    const noteTitleEl = $('#tree-prefix-note-title');

    let noteTreeId;

    async function showDialog() {
        glob.activeDialog = dialogEl;

        await dialogEl.dialog({
            modal: true,
            width: 800
        });

        const currentNode = noteTree.getCurrentNode();

        noteTreeId = currentNode.data.note_tree_id;

        treePrefixInputEl.val(currentNode.data.prefix).focus();

        const noteTitle = noteTree.getNoteTitle(currentNode.data.note_id);

        noteTitleEl.html(noteTitle);
    }

    formEl.submit(() => {
        const prefix = treePrefixInputEl.val();

        server.put('tree/' + noteTreeId + '/setPrefix', {
            prefix: prefix
        }).then(() => noteTree.setPrefix(noteTreeId, prefix));

        dialogEl.dialog("close");

        return false;
    });

    return {
        showDialog
    };
})();