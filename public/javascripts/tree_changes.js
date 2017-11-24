"use strict";

const treeChanges = (function() {
    async function moveBeforeNode(node, beforeNode) {
        await $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveBefore/' + beforeNode.data.note_tree_id,
            type: 'PUT',
            contentType: "application/json"
        });

        node.moveTo(beforeNode, 'before');

        noteTree.setCurrentNotePathToHash(node);
    }

    async function moveAfterNode(node, afterNode) {
        await $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveAfter/' + afterNode.data.note_tree_id,
            type: 'PUT',
            contentType: "application/json"
        });

        node.moveTo(afterNode, 'after');

        noteTree.setCurrentNotePathToHash(node);
    }

    // beware that first arg is noteId and second is noteTreeId!
    async function cloneNoteAfter(noteId, afterNoteTreeId) {
        const resp = await $.ajax({
            url: baseApiUrl + 'notes/' + noteId + '/cloneAfter/' + afterNoteTreeId,
            type: 'PUT',
            error: () => showError("Error cloning note.")
        });

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await noteTree.reload();
    }

    async function moveToNode(node, toNode) {
        await $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveTo/' + toNode.data.note_id,
            type: 'PUT',
            contentType: "application/json"
        });

        node.moveTo(toNode);

        toNode.setExpanded(true);

        toNode.folder = true;
        toNode.renderTitle();

        noteTree.setCurrentNotePathToHash(node);
    }

    async function cloneNoteTo(childNoteId, parentNoteId) {
        const resp = await $.ajax({
            url: baseApiUrl + 'notes/' + childNoteId + '/cloneTo/' + parentNoteId,
            type: 'PUT',
            error: () => showError("Error cloning note.")
        });

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await noteTree.reload();
    }

    async function deleteNode(node) {
        if (!confirm('Are you sure you want to delete note "' + node.title + '"?')) {
            return;
        }

        await $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id,
            type: 'DELETE'
        });

        if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
            node.getParent().folder = false;
            node.getParent().renderTitle();
        }

        recentNotes.removeRecentNote(node.note_tree_id);

        let next = node.getNextSibling();
        if (!next) {
            next = node.getParent();
        }

        node.remove();

        // activate next element after this one is deleted so we don't lose focus
        next.setActive();

        noteTree.setCurrentNotePathToHash(next);
    }

    async function moveNodeUp(node) {
        if (node.getParent() !== null) {
            $.ajax({
                url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveAfter/' + node.getParent().data.note_tree_id,
                type: 'PUT',
                contentType: "application/json",
                success: () => {
                    if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                        node.getParent().folder = false;
                        node.getParent().renderTitle();
                    }

                    node.moveTo(node.getParent(), 'after');

                    noteTree.setCurrentNotePathToHash(node);
                }
            });
        }
    }

    return {
        moveBeforeNode,
        moveAfterNode,
        moveToNode,
        deleteNode,
        moveNodeUp,
        cloneNoteAfter,
        cloneNoteTo
    };
})();