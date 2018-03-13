"use strict";

const treeUtils = (function() {
    const $tree = $("#tree");

    function getParentProtectedStatus(node) {
        return isTopLevelNode(node) ? 0 : node.getParent().data.isProtected;
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

        while (node && !isRootNode(node)) {
            if (node.data.noteId) {
                path.push(node.data.noteId);
            }

            node = node.getParent();
        }

        return path.reverse().join("/");
    }

    return {
        getParentProtectedStatus,
        getNodeByKey,
        getNotePath,
        getNoteIdFromNotePath,
    };
})();