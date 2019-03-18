import treeService from './tree.js';
import utils from './utils.js';
import server from './server.js';
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import treeBuilder from "./tree_builder.js";

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

        await changeNode(
            node => node.moveTo(beforeNode, 'before'),
            nodeToMove,
            beforeNode.data.noteId,
            null);
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

        await changeNode(
            node => node.moveTo(afterNode, 'after'),
            nodeToMove,
            null,
            afterNode.data.noteId);
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

        await changeNode(async node => {
                // first expand which will force lazy load and only then move the node
                // if this is not expanded before moving, then lazy load won't happen because it already contains node
                // this doesn't work if this isn't a folder yet, that's why we expand second time below
                await toNode.setExpanded(true);

                node.moveTo(toNode);
            }, nodeToMove);
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

    await changeNode(
        node => node.moveTo(node.getParent(), 'after'),
        node);
}

async function checkFolderStatus(node) {
    const children = node.getChildren();
    const note = await treeCache.getNote(node.data.noteId);

    if (!children || children.length === 0) {
        node.folder = false;
        node.icon = await treeBuilder.getIcon(note);
        node.renderTitle();
    }
    else if (children && children.length > 0) {
        node.folder = true;
        node.icon = await treeBuilder.getIcon(note);
        node.renderTitle();
    }
}

async function changeNode(func, node, beforeNoteId = null, afterNoteId = null) {
    utils.assertArguments(func, node);

    const childNoteId = node.data.noteId;
    const thisOldParentNode = node.getParent();

    // this will move the node the user is directly operating on to the desired location
    // note that there might be other instances of this note in the tree and those are updated through
    // force reloading. We could simplify our lives by just reloading this one as well, but that leads
    // to flickering and not good user experience. Current solution leads to no-flicker experience in most
    // cases (since cloning is not used that often) and correct for multi-clone use cases
    await func(node);

    const thisNewParentNode = node.getParent();

    node.data.parentNoteId = thisNewParentNode.data.noteId;

    await treeCache.moveNote(childNoteId, thisOldParentNode.data.noteId, thisNewParentNode.data.noteId, beforeNoteId, afterNoteId);

    treeService.setCurrentNotePathToHash(node);

    await checkFolderStatus(thisOldParentNode);
    await checkFolderStatus(thisNewParentNode);

    if (!thisNewParentNode.isExpanded()) {
        // this expands the note in case it become the folder only after the move
        await thisNewParentNode.setExpanded(true);
    }

    for (const newParentNode of treeService.getNodesByNoteId(thisNewParentNode.data.noteId)) {
        if (newParentNode.key === thisNewParentNode.key) {
            // this one has been handled above specifically
            continue;
        }

        newParentNode.load(true); // force reload to show up new note

        await checkFolderStatus(newParentNode);
    }

    for (const oldParentNode of treeService.getNodesByNoteId(thisOldParentNode.data.noteId)) {
        if (oldParentNode.key === thisOldParentNode.key) {
            // this one has been handled above specifically
            continue;
        }

        await oldParentNode.load(true); // force reload to show up new note

        await checkFolderStatus(oldParentNode);
    }
}

export default {
    moveBeforeNode,
    moveAfterNode,
    moveToNode,
    deleteNodes,
    moveNodeUpInHierarchy
};