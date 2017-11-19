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

    function getFullName(noteTreeId) {
        let note = noteTree.getByNoteId(noteTreeId);

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

    function getNotePath(node) {
        const path = [];

        while (node) {
            if (node.data.note_tree_id) {
                path.push(node.data.note_tree_id);
            }

            node = node.getParent();
        }

        return path.reverse().join("/");
    }

    return {
        getParentNoteTreeId,
        getParentProtectedStatus,
        getNodeByKey,
        getNodeByNoteTreeId,
        getNoteTitle,
        getFullName,
        getNotePath
    };
})();