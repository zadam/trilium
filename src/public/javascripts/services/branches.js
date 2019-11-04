import treeService from './tree.js';
import utils from './utils.js';
import server from './server.js';
import toastService from "./toast.js";
import treeCache from "./tree_cache.js";
import treeUtils from "./tree_utils.js";
import hoistedNoteService from "./hoisted_note.js";
import noteDetailService from "./note_detail.js";
import ws from "./ws.js";

async function moveBeforeNode(nodesToMove, beforeNode) {
    nodesToMove = await filterRootNote(nodesToMove);

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
            nodeToMove);
    }
}

async function moveAfterNode(nodesToMove, afterNode) {
    nodesToMove = await filterRootNote(nodesToMove);

    if (afterNode.data.noteId === 'root' || afterNode.data.noteId === await hoistedNoteService.getHoistedNoteId()) {
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
            nodeToMove);
    }
}

async function moveToNode(nodesToMove, toNode) {
    nodesToMove = await filterRootNote(nodesToMove);

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

async function getNextNode(nodes) {
    // following code assumes that nodes contain only top-most selected nodes - getSelectedNodes has been
    // called with stopOnParent=true
    let next = nodes[nodes.length - 1].getNextSibling();

    if (!next) {
        next = nodes[0].getPrevSibling();
    }

    if (!next && !await hoistedNoteService.isRootNode(nodes[0])) {
        next = nodes[0].getParent();
    }

    return treeUtils.getNotePath(next);
}

async function deleteNodes(nodes) {
    nodes = await filterRootNote(nodes);

    if (nodes.length === 0) {
        return false;
    }

    const $deleteClonesCheckbox = $('<div class="form-check">')
        .append($('<input type="checkbox" class="form-check-input" id="delete-clones-checkbox">'))
        .append($('<label for="delete-clones-checkbox">')
                    .text("delete also all note clones")
                    .attr("title", "all clones of selected notes will be deleted and as such the whole note will be deleted."));
    const $nodeTitles = $("<ul>").append(...nodes.map(node => $("<li>").text(node.title)));
    const $confirmText = $("<div>")
        .append($("<p>").text('This will delete the following notes and their sub-notes: '))
        .append($nodeTitles)
        .append($deleteClonesCheckbox);

    const confirmDialog = await import('../dialogs/confirm.js');

    if (!await confirmDialog.confirm($confirmText)) {
        return false;
    }

    const deleteClones = $deleteClonesCheckbox.find("input").is(":checked");

    const taskId = utils.randomString(10);

    let counter = 0;

    for (const node of nodes) {
        counter++;

        const last = counter === nodes.length;
        const query = `?taskId=${taskId}&last=${last ? 'true' : 'false'}`;

        if (deleteClones) {
            await server.remove(`notes/${node.data.noteId}` + query);

            noteDetailService.noteDeleted(node.data.noteId);
        }
        else {
            const {noteDeleted} = await server.remove(`branches/${node.data.branchId}` + query);

            if (noteDeleted) {
                noteDetailService.noteDeleted(node.data.noteId);
            }
        }
    }

    const nextNotePath = await getNextNode(nodes);

    const noteIds = Array.from(new Set(nodes.map(node => node.getParent().data.noteId)));

    await treeService.reloadNotes(noteIds, nextNotePath);

    return true;
}

async function moveNodeUpInHierarchy(node) {
    if (await hoistedNoteService.isRootNode(node) || await hoistedNoteService.isTopLevelNode(node)) {
        return;
    }

    const resp = await server.put('branches/' + node.data.branchId + '/move-after/' + node.getParent().data.branchId);

    if (!resp.success) {
        alert(resp.message);
        return;
    }

    if (!hoistedNoteService.isTopLevelNode(node) && node.getParent().getChildren().length <= 1) {
        node.getParent().folder = false;
        node.getParent().renderTitle();
    }

    await changeNode(
        node => node.moveTo(node.getParent(), 'after'),
        node);
}

async function changeNode(func, node) {
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

    await treeCache.reloadNotes([childNoteId]);

    await treeService.checkFolderStatus(thisOldParentNode);
    await treeService.checkFolderStatus(thisNewParentNode);

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

        await treeService.checkFolderStatus(newParentNode);
    }

    for (const oldParentNode of treeService.getNodesByNoteId(thisOldParentNode.data.noteId)) {
        if (oldParentNode.key === thisOldParentNode.key) {
            // this one has been handled above specifically
            continue;
        }

        await oldParentNode.load(true); // force reload to show up new note

        await treeService.checkFolderStatus(oldParentNode);
    }
}

async function filterRootNote(nodes) {
    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    return nodes.filter(node =>
        node.data.noteId !== 'root'
        && node.data.noteId !== hoistedNoteId);
}

function makeToast(id, message) {
    return {
        id: id,
        title: "Delete status",
        message: message,
        icon: "trash"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'delete-notes') {
        return;
    }

    if (message.type === 'task-error') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'task-progress-count') {
        toastService.showPersistent(makeToast(message.taskId, "Delete notes in progress: " + message.progressCount));
    } else if (message.type === 'task-succeeded') {
        const toast = makeToast(message.taskId, "Delete finished successfully.");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});

export default {
    moveBeforeNode,
    moveAfterNode,
    moveToNode,
    deleteNodes,
    moveNodeUpInHierarchy
};