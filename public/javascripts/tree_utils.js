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

    async function activateNode(noteTreeIdToActivate) {
        const noteTreeIdPath = [ noteTreeIdToActivate ];

        let note = noteTree.getByNoteId(noteTreeIdToActivate);

        while (note) {
            if (note.note_pid !== 'root') {
                noteTreeIdPath.push(note.note_pid);
            }

            note = noteTree.getByNoteId(note.note_pid);
        }

        for (const noteTreeId of noteTreeIdPath.reverse()) {
            const node = treeUtils.getNodeByNoteTreeId(noteTreeId);

            if (noteTreeId !== noteTreeIdToActivate) {
                await node.setExpanded();
            }
            else {
                await node.setActive();
            }
        }
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

    return {
        getParentNoteTreeId,
        getParentProtectedStatus,
        getNodeByKey,
        getNodeByNoteTreeId,
        activateNode,
        getNoteTitle,
        getFullName
    };
})();