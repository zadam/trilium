"use strict";

const treeChanges = (function() {
    function moveBeforeNode(node, beforeNode) {
        $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveBefore/' + beforeNode.data.note_tree_id,
            type: 'PUT',
            contentType: "application/json",
            success: () => {
                node.moveTo(beforeNode, 'before');

                noteTree.setCurrentNotePathToHash(node);
            }
        });
    }

    function moveAfterNode(node, afterNode) {
        $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveAfter/' + afterNode.data.note_tree_id,
            type: 'PUT',
            contentType: "application/json",
            success: () => {
                node.moveTo(afterNode, 'after');

                noteTree.setCurrentNotePathToHash(node);
            }
        });
    }

    function moveToNode(node, toNode) {
        $.ajax({
            url: baseApiUrl + 'notes/' + node.data.note_tree_id + '/moveTo/' + toNode.data.note_id,
            type: 'PUT',
            contentType: "application/json",
            success: () => {
                node.moveTo(toNode);

                toNode.setExpanded(true);

                toNode.folder = true;
                toNode.renderTitle();

                noteTree.setCurrentNotePathToHash(node);
            }
        });
    }

    function deleteNode(node) {
        if (confirm('Are you sure you want to delete note "' + node.title + '"?')) {
            $.ajax({
                url: baseApiUrl + 'notes/' + node.key,
                type: 'DELETE',
                success: () => {
                    if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                        node.getParent().folder = false;
                        node.getParent().renderTitle();
                    }

                    glob.allNoteIds = glob.allNoteIds.filter(e => e !== node.key);

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
            });
        }
    }

    function moveNodeUp(node) {
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
        moveNodeUp
    };
})();