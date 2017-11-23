"use strict";

const treeUtils = (function() {
    const treeEl = $("#tree");

    function getParentProtectedStatus(node) {
        return node.getParent() === null ? 0 : node.getParent().data.is_protected;
    }

    function getNodeByKey(key) {
        return treeEl.fancytree('getNodeByKey', key);
    }

    function getNodeByNoteTreeId(noteTreeId) {
        const key = noteTree.getKeyFromNoteTreeId(noteTreeId);

        return getNodeByKey(key);
    }

    function getNoteIdFromNotePath(notePath) {
        const path = notePath.split("/");

        return path[path.length - 1];
    }

    function getFullNameForPath(notePath) {
        const path = notePath.split("/");
        const titlePath = path.map(noteId => noteTree.getNoteTitle(noteId));

        return titlePath.join(" > ");
    }

    function getNotePath(node) {
        const path = [];

        while (node) {
            if (node.data.note_id) {
                path.push(node.data.note_id);
            }

            node = node.getParent();
        }

        return path.reverse().join("/");
    }

    return {
        getParentProtectedStatus,
        getNodeByKey,
        getNodeByNoteTreeId,
        getFullNameForPath,
        getNotePath,
        getNoteIdFromNotePath
    };
})();