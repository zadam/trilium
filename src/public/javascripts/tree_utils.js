"use strict";

const treeUtils = (function() {
    const treeEl = $("#tree");

    function getParentProtectedStatus(node) {
        return isTopLevelNode(node) ? 0 : node.getParent().data.isProtected;
    }

    function getNodeByKey(key) {
        return treeEl.fancytree('getNodeByKey', key);
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

    function setNodeTitleWithPrefix(node) {
        const noteTitle = noteTree.getNoteTitle(node.data.noteId);
        const prefix = node.data.prefix;

        const title = (prefix ? (prefix + " - ") : "") + noteTitle;

        node.setTitle(escapeHtml(title));
    }

    return {
        getParentProtectedStatus,
        getNodeByKey,
        getNotePath,
        getNoteIdFromNotePath,
        setNodeTitleWithPrefix
    };
})();