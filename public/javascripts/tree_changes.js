"use strict";

const treeChanges = (function() {
    async function moveBeforeNode(node, beforeNode) {
        await server.put('notes/' + node.data.note_tree_id + '/move-before/' + beforeNode.data.note_tree_id);

        node.moveTo(beforeNode, 'before');

        noteTree.setCurrentNotePathToHash(node);
    }

    async function moveAfterNode(node, afterNode) {
        await server.put('notes/' + node.data.note_tree_id + '/move-after/' + afterNode.data.note_tree_id);

        node.moveTo(afterNode, 'after');

        noteTree.setCurrentNotePathToHash(node);
    }

    // beware that first arg is noteId and second is noteTreeId!
    async function cloneNoteAfter(noteId, afterNoteTreeId) {
        const resp = await server.put('notes/' + noteId + '/clone-after/' + afterNoteTreeId);

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await noteTree.reload();
    }

    async function moveToNode(node, toNode) {
        await server.put('notes/' + node.data.note_tree_id + '/move-to/' + toNode.data.note_id);

        node.moveTo(toNode);

        toNode.setExpanded(true);

        toNode.folder = true;
        toNode.renderTitle();

        noteTree.setCurrentNotePathToHash(node);
    }

    async function cloneNoteTo(childNoteId, parentNoteId) {
        const resp = await server.put('notes/' + childNoteId + '/clone-to/' + parentNoteId);

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

        await server.remove('notes/' + node.data.note_tree_id);

        if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
            node.getParent().folder = false;
            node.getParent().renderTitle();
        }

        let next = node.getNextSibling();
        if (!next) {
            next = node.getParent();
        }

        node.remove();

        // activate next element after this one is deleted so we don't lose focus
        next.setActive();

        noteTree.setCurrentNotePathToHash(next);
    }

    async function moveNodeUpInHierarchy(node) {
        if (node.getParent() === null) {
            return;
        }

        await server.put('notes/' + node.data.note_tree_id + '/move-after/' + node.getParent().data.note_tree_id);

        if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
            node.getParent().folder = false;
            node.getParent().renderTitle();
        }

        node.moveTo(node.getParent(), 'after');

        noteTree.setCurrentNotePathToHash(node);
    }

    return {
        moveBeforeNode,
        moveAfterNode,
        moveToNode,
        deleteNode,
        moveNodeUpInHierarchy,
        cloneNoteAfter,
        cloneNoteTo
    };
})();