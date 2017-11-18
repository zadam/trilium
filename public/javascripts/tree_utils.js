"use strict";

const treeUtils = (function() {
    const treeEl = $("#tree");

    function getParentKey(node) {
        return (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;
    }

    function getParentProtectedStatus(node) {
        return node.getParent() === null ? 0 : node.getParent().data.is_protected;
    }

    function getNodeByKey(noteId) {
        return treeEl.fancytree('getNodeByKey', noteId);
    }

    function activateNode(noteId) {
        const node = treeUtils.getNodeByKey(noteId);

        node.setActive();
    }

    function getNoteTitle(noteId) {
        const note = treeUtils.getNodeByKey(noteId);
        if (!note) {
            return;
        }

        let noteTitle = note.title;

        if (noteTitle.endsWith(" (clone)")) {
            noteTitle = noteTitle.substr(0, noteTitle.length - 8);
        }

        return noteTitle;
    }

    function getFullName(noteId) {
        let note = noteTree.getByNoteId(noteId);

        if (note === null) {
            return "[unknown]";
        }

        const path = [];

        while (note) {
            path.push(note.note_title);

            note = noteTree.getByNoteId(note.note_pid);
        }

        return path.reverse().join(" > ");
    }

    return {
        getParentKey,
        getParentProtectedStatus,
        getNodeByKey,
        activateNode,
        getNoteTitle,
        getFullName
    };
})();