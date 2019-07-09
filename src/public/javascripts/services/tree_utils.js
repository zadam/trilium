import utils from './utils.js';
import hoistedNoteService from './hoisted_note.js';
import treeCache from "./tree_cache.js";

const $tree = $("#tree");

async function getParentProtectedStatus(node) {
    return await hoistedNoteService.isRootNode(node) ? 0 : node.getParent().data.isProtected;
}

function getNodeByKey(key) {
    return $tree.fancytree('getNodeByKey', key);
}

function getNoteIdFromNotePath(notePath) {
    if (!notePath) {
        return null;
    }

    const path = notePath.split("/");

    const lastSegment = path[path.length - 1];

    // path could have also tabId suffix
    return lastSegment.split("-")[0];
}

async function getNotePath(node) {
    if (!node) {
        console.error("Node is null");
        return "";
    }

    const path = [];

    while (node && !await hoistedNoteService.isRootNode(node)) {
        if (node.data.noteId) {
            path.push(node.data.noteId);
        }

        node = node.getParent();
    }

    if (node) { // null node can happen directly after unhoisting when tree is still hoisted but option has been changed already
        path.push(node.data.noteId); // root or hoisted noteId
    }

    return path.reverse().join("/");
}

async function getNoteTitle(noteId, parentNoteId = null) {
    utils.assertArguments(noteId);

    const note = await treeCache.getNote(noteId);
    if (!note) {
        return "[not found]";
    }

    let {title} = note;

    if (parentNoteId !== null) {
        const branch = await treeCache.getBranchByChildParent(noteId, parentNoteId);

        if (branch && branch.prefix) {
            title = branch.prefix + ' - ' + title;
        }
    }

    return title;
}

async function getNotePathTitle(notePath) {
    utils.assertArguments(notePath);

    const titlePath = [];

    if (notePath.startsWith('root/')) {
        notePath = notePath.substr(5);
    }

    // special case when we want just root's title
    if (notePath === 'root') {
        return await getNoteTitle(notePath);
    }

    let parentNoteId = 'root';

    for (const noteId of notePath.split('/')) {
        titlePath.push(await getNoteTitle(noteId, parentNoteId));

        parentNoteId = noteId;
    }

    return titlePath.join(' / ');
}

export default {
    getParentProtectedStatus,
    getNodeByKey,
    getNotePath,
    getNoteIdFromNotePath,
    getNoteTitle,
    getNotePathTitle,
};