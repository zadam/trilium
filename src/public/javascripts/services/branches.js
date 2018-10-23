import treeService from './tree.js';
import utils from './utils.js';
import server from './server.js';
import infoService from "./info.js";
import treeCache from "./tree_cache.js";

async function moveBeforeNode(nodesToMove, beforeNode) {
    nodesToMove = filterRootNote(nodesToMove);

    if (beforeNode.data.noteId === 'root') {
        alert('Cannot move notes before root note.');
        return;
    }

    for (const nodeToMove of nodesToMove) {
        const resp = await server.put('branches/' + nodeToMove.data.branchId + '/move-before/' + beforeNode.data.branchId);

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await changeNode(nodeToMove, node => node.moveTo(beforeNode, 'before'));
    }
}

async function moveAfterNode(nodesToMove, afterNode) {
    nodesToMove = filterRootNote(nodesToMove);

    if (afterNode.data.noteId === 'root') {
        alert('Cannot move notes after root note.');
        return;
    }

    nodesToMove.reverse(); // need to reverse to keep the note order

    for (const nodeToMove of nodesToMove) {
        const resp = await server.put('branches/' + nodeToMove.data.branchId + '/move-after/' + afterNode.data.branchId);

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await changeNode(nodeToMove, node => node.moveTo(afterNode, 'after'));
    }
}

async function moveToNode(nodesToMove, toNode) {
    nodesToMove = filterRootNote(nodesToMove);

    for (const nodeToMove of nodesToMove) {
        const resp = await server.put('branches/' + nodeToMove.data.branchId + '/move-to/' + toNode.data.noteId);

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await changeNode(nodeToMove, async node => {
            // first expand which will force lazy load and only then move the node
            // if this is not expanded before moving, then lazy load won't happen because it already contains node
            // this doesn't work if this isn't a folder yet, that's why we expand second time below
            await toNode.setExpanded(true);

            node.moveTo(toNode);

            toNode.folder = true;
            toNode.renderTitle();

            // this expands the note in case it become the folder only after the move
            await toNode.setExpanded(true);
        });
    }
}

function filterRootNote(nodes) {
    // some operations are not possible on root notes
    return nodes.filter(node => node.data.noteId !== 'root');
}

async function deleteNodes(nodes) {
    nodes = filterRootNote(nodes);

    if (nodes.length === 0 || !confirm('Are you sure you want to delete select note(s) and all the sub-notes?')) {
        return;
    }

    for (const node of nodes) {
        await server.remove('branches/' + node.data.branchId);
    }

    // following code assumes that nodes contain only top-most selected nodes - getSelectedNodes has been
    // called with stopOnParent=true
    let next = nodes[nodes.length - 1].getNextSibling();

    if (!next) {
        next = nodes[0].getPrevSibling();
    }

    if (!next && !utils.isTopLevelNode(nodes[0])) {
        next = nodes[0].getParent();
    }

    if (next) {
        // activate next element after this one is deleted so we don't lose focus
        next.setActive();

        treeService.setCurrentNotePathToHash(next);
    }

    infoService.showMessage("Note(s) has been deleted.");

    await treeService.reload();
}

async function moveNodeUpInHierarchy(node) {
    if (utils.isRootNode(node) || utils.isTopLevelNode(node)) {
        return;
    }

    const resp = await server.put('branches/' + node.data.branchId + '/move-after/' + node.getParent().data.branchId);

    if (!resp.success) {
        alert(resp.message);
        return;
    }

    if (!utils.isTopLevelNode(node) && node.getParent().getChildren().length <= 1) {
        node.getParent().folder = false;
        node.getParent().renderTitle();
    }

    await changeNode(node, node => node.moveTo(node.getParent(), 'after'));
}

async function changeNode(node, func) {
    utils.assertArguments(node.data.parentNoteId, node.data.noteId);

    const childNoteId = node.data.noteId;
    const oldParentNoteId = node.data.parentNoteId;

    await func(node);

    const newParentNoteId = node.data.parentNoteId = utils.isTopLevelNode(node) ? 'root' : node.getParent().data.noteId;

    await treeCache.moveNote(childNoteId, oldParentNoteId, newParentNoteId);

    treeService.setCurrentNotePathToHash(node);
}

export default {
    moveBeforeNode,
    moveAfterNode,
    moveToNode,
    deleteNodes,
    moveNodeUpInHierarchy
};