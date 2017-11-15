"use strict";

const treeUtils = (function() {
    const treeEl = $("#tree");

    function getParentKey(node) {
        return (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;
    }

    function getParentEncryption(node) {
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
        let note = treeUtils.getNodeByKey(noteId);

        if (note === null) {
            return "[unknown]";
        }

        // why?
        if (note.data.is_clone) {
            return null;
        }

        const path = [];

        while (note) {
            path.push(note.title);

            note = note.getParent();
        }

        // remove "root" element
        path.pop();

        return path.reverse().join(" > ");
    }

    return {
        getParentKey,
        getParentEncryption,
        getNodeByKey,
        activateNode,
        getNoteTitle,
        getFullName
    };
})();