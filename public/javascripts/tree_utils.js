"use strict";

const treeUtils = (function() {
    const treeEl = $("#tree");

    function getParentNoteTreeId(node) {
        return node.note_pid;
    }

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

    function getFullName(noteTreeId) {
        let note = noteTree.getByNoteTreeId(noteTreeId);

        if (note === null) {
            return "[unknown]";
        }

        const path = [];

        while (note) {
            path.push(note.note_title);

            note = noteTree.getByNoteTreeId(note.note_pid);
        }

        return path.reverse().join(" > ");
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

    async function addAsChild(parentNotePath, childNotePath) {
        const parentNoteId = treeUtils.getNoteIdFromNotePath(parentNotePath);
        const childNoteId = treeUtils.getNoteIdFromNotePath(childNotePath);

        await $.ajax({
            url: baseApiUrl + 'tree/' + parentNoteId + '/addChild/' + childNoteId,
            type: 'PUT',
            error: () => showError("Error adding child.")
        });

        await noteTree.reload();
    }

    return {
        getParentNoteTreeId,
        getParentProtectedStatus,
        getNodeByKey,
        getNodeByNoteTreeId,
        getFullName,
        getFullNameForPath,
        getNotePath,
        getNoteIdFromNotePath,
        addAsChild
    };
})();