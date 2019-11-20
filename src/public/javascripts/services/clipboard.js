import treeUtils from "./tree_utils.js";
import treeChangesService from "./branches.js";
import cloningService from "./cloning.js";
import toastService from "./toast.js";
import hoistedNoteService from "./hoisted_note.js";

/*
 * Clipboard contains node keys which are not stable. If a (part of the) tree is reloaded,
 * node keys in the clipboard might not exist anymore. Code here should then be ready to deal
 * with this.
 */

let clipboardNodeKeys = [];
let clipboardMode = null;

async function pasteAfter(afterNode) {
    if (isClipboardEmpty()) {
        return;
    }

    if (clipboardMode === 'cut') {
        const nodes = clipboardNodeKeys.map(nodeKey => treeUtils.getNodeByKey(nodeKey));

        await treeChangesService.moveAfterNode(nodes, afterNode);

        clipboardNodeKeys = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        for (const nodeKey of clipboardNodeKeys) {
            const clipNode = treeUtils.getNodeByKey(nodeKey);

            await cloningService.cloneNoteAfter(clipNode.data.noteId, afterNode.data.branchId);
        }

        // copy will keep clipboardIds and clipboardMode so it's possible to paste into multiple places
    }
    else {
        toastService.throwError("Unrecognized clipboard mode=" + clipboardMode);
    }
}

async function pasteInto(parentNode) {
    if (isClipboardEmpty()) {
        return;
    }

    if (clipboardMode === 'cut') {
        const nodes = clipboardNodeKeys.map(nodeKey => treeUtils.getNodeByKey(nodeKey));

        await treeChangesService.moveToNode(nodes, parentNode);

        await parentNode.setExpanded(true);

        clipboardNodeKeys = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        for (const nodeKey of clipboardNodeKeys) {
            const clipNode = treeUtils.getNodeByKey(nodeKey);

            await cloningService.cloneNoteTo(clipNode.data.noteId, parentNode.data.noteId);
        }

        await parentNode.setExpanded(true);

        // copy will keep clipboardIds and clipboardMode so it's possible to paste into multiple places
    }
    else {
        toastService.throwError("Unrecognized clipboard mode=" + mode);
    }
}

function copy(nodes) {
    clipboardNodeKeys = nodes.map(node => node.key);
    clipboardMode = 'copy';

    toastService.showMessage("Note(s) have been copied into clipboard.");
}

function cut(nodes) {
    clipboardNodeKeys = nodes
        .filter(node => node.data.noteId !== hoistedNoteService.getHoistedNoteNoPromise())
        .filter(node => node.getParent().data.noteType !== 'search')
        .map(node => node.key);

    if (clipboardNodeKeys.length > 0) {
        clipboardMode = 'cut';

        toastService.showMessage("Note(s) have been cut into clipboard.");
    }
}

function isClipboardEmpty() {
    clipboardNodeKeys = clipboardNodeKeys.filter(key => !!treeUtils.getNodeByKey(key));

    return clipboardNodeKeys.length === 0;
}

export default {
    pasteAfter,
    pasteInto,
    cut,
    copy,
    isClipboardEmpty
}