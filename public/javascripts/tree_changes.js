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
            // first expand which will force lazy load and only then move the node
            // if this is not expanded before moving, then lazy load won't happen because it already contains node
            toNode.setExpanded(true);

            node.moveTo(toNode);

            toNode.folder = true;
            toNode.renderTitle();
        });
    }

    async function cloneNoteTo(childNoteId, parentNoteId, prefix) {
        const resp = await server.put('notes/' + childNoteId + '/clone-to/' + parentNoteId, {
            prefix: prefix
        });

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await noteTree.reload();
    }

    async function deleteNode(node) {
        if (!confirm('Are you sure you want to delete note "' + node.title + '" and all its sub-notes?')) {
            return;
        }

        await server.remove('notes/' + node.data.note_tree_id);

        if (!isTopLevelNode(node) && node.getParent().getChildren().length <= 1) {
            node.getParent().folder = false;
            node.getParent().renderTitle();
        }

        let next = node.getNextSibling();

        if (!next) {
            next = node.getPrevSibling();
        }

        if (!next && !isTopLevelNode(node)) {
            next = node.getParent();
        }

        node.remove();

        if (next) {
            // activate next element after this one is deleted so we don't lose focus
            next.setActive();

            noteTree.setCurrentNotePathToHash(next);
        }

        noteTree.reload();

        showMessage("Note has been deleted.");
    }

    async function moveNodeUpInHierarchy(node) {
        if (isTopLevelNode(node)) {
            return;
        }

        await server.put('notes/' + node.data.note_tree_id + '/move-after/' + node.getParent().data.note_tree_id);

        if (!isTopLevelNode(node) && node.getParent().getChildren().length <= 1) {
            node.getParent().folder = false;
            node.getParent().renderTitle();
        }

        changeNode(node, node => node.moveTo(node.getParent(), 'after'));
    }

    function changeNode(node, func) {
        assertArguments(node.data.parent_note_id, node.data.note_id);

        noteTree.removeParentChildRelation(node.data.parent_note_id, node.data.note_id);

        func(node);

        node.data.parent_note_id = isTopLevelNode(node) ? 'root' : node.getParent().data.note_id;

        noteTree.setParentChildRelation(node.data.note_tree_id, node.data.parent_note_id, node.data.note_id);

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