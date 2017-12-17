"use strict";

const treeChanges = (function() {
    async function moveBeforeNode(node, beforeNode) {
        await server.put('notes/' + node.data.note_tree_id + '/move-before/' + beforeNode.data.note_tree_id);

        changeNode(node, node => node.moveTo(beforeNode, 'before'));
    }

    async function moveAfterNode(node, afterNode) {
        await server.put('notes/' + node.data.note_tree_id + '/move-after/' + afterNode.data.note_tree_id);

        changeNode(node, node => node.moveTo(afterNode, 'after'));
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

        changeNode(node, node => {
            node.moveTo(toNode);

            toNode.setExpanded(true);

            toNode.folder = true;
            toNode.renderTitle();
        });
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
            next = node.getPrevSibling();
        }

        if (!next) {
            next = node.getParent();
        }

        node.remove();

        // activate next element after this one is deleted so we don't lose focus
        next.setActive();

        noteTree.setCurrentNotePathToHash(next);
        noteTree.reload();
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

        changeNode(node, node => node.moveTo(node.getParent(), 'after'));
    }

    function changeNode(node, func) {
        noteTree.removeParentChildRelation(node.data.note_pid, node.data.note_id);

        func(node);

        node.data.note_pid = node.getParent() === null ? 'root' : node.getParent().data.note_id;

        noteTree.setParentChildRelation(node.data.note_tree_id, node.data.note_pid, node.data.note_id);

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