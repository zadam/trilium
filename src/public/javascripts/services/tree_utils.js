import utils from './utils.js';
import treeCache from "./tree_cache.js";

const $tree = $("#tree");

function getParentProtectedStatus(node) {
    return utils.isTopLevelNode(node) ? 0 : node.getParent().data.isProtected;
}

function getNodeByKey(key) {
    return $tree.fancytree('getNodeByKey', key);
}

function getNoteIdFromNotePath(notePath) {
    const path = notePath.split("/");

    return path[path.length - 1];
}

function getNotePath(node) {
    const path = [];

    while (node && !utils.isRootNode(node)) {
        if (node.data.noteId) {
            path.push(node.data.noteId);
        }

        node = node.getParent();
    }

    return path.reverse().join("/");
}

async function getNoteTitle(noteId, parentNoteId = null) {
    utils.assertArguments(noteId);

    let {title} = await treeCache.getNote(noteId);

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