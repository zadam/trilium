function moveBeforeNode(node, beforeNode) {
    $.ajax({
        url: baseUrl + 'notes/' + node.key + '/moveBefore/' + beforeNode.key,
        type: 'PUT',
        contentType: "application/json",
        success: function () {
            node.moveTo(beforeNode, 'before');
        }
    });
}

function moveAfterNode(node, afterNode) {
    $.ajax({
        url: baseUrl + 'notes/' + node.key + '/moveAfter/' + afterNode.key,
        type: 'PUT',
        contentType: "application/json",
        success: function () {
            node.moveTo(afterNode, 'after');
        }
    });
}

function moveToNode(node, toNode) {
    $.ajax({
        url: baseUrl + 'notes/' + node.key + '/moveTo/' + toNode.key,
        type: 'PUT',
        contentType: "application/json",
        success: function () {
            node.moveTo(toNode);

            toNode.setExpanded(true);

            toNode.folder = true;
            toNode.renderTitle();
        }
    });
}

function deleteNode(node) {
    if (confirm('Are you sure you want to delete note "' + node.title + '"?')) {
        $.ajax({
            url: baseUrl + 'notes/' + node.key,
            type: 'DELETE',
            success: function () {
                if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                    node.getParent().folder = false;
                    node.getParent().renderTitle();
                }

                globalAllNoteIds = globalAllNoteIds.filter(e => e !== node.key);

                // remove from recent notes
                globalRecentNotes = globalRecentNotes.filter(note => note !== node.key);

                let next = node.getNextSibling();
                if (!next) {
                    next = node.getParent();
                }

                node.remove();

                // activate next element after this one is deleted so we don't lose focus
                next.setActive();
            }
        });
    }
}

function moveNodeUp(node) {
    if (node.getParent() !== null) {
        $.ajax({
            url: baseUrl + 'notes/' + node.key + '/moveAfter/' + node.getParent().key,
            type: 'PUT',
            contentType: "application/json",
            success: function () {
                if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                    node.getParent().folder = false;
                    node.getParent().renderTitle();
                }

                node.moveTo(node.getParent(), 'after');
            }
        });
    }
}