import utils from './utils.js';

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

export default {
    getParentProtectedStatus,
    getNodeByKey,
    getNotePath,
    getNoteIdFromNotePath,
};