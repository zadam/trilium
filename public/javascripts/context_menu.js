"use strict";

const contextMenu = (function() {
    const treeEl = $("#tree");

    function pasteAfter(node) {
        const subjectNode = treeUtils.getNodeByNoteTreeId(noteTree.getClipboardNoteTreeId());

        treeChanges.moveAfterNode(subjectNode, node);

        noteTree.setClipboardNoteTreeId(null);
    }

    function pasteInto(node) {
        const subjectNode = treeUtils.getNodeByNoteTreeId(noteTree.getClipboardNoteTreeId());

        treeChanges.moveToNode(subjectNode, node);

        noteTree.setClipboardNoteTreeId(null);
    }

    function cut(node) {
        noteTree.setClipboardNoteTreeId(node.note_tree_id);
    }

    const contextMenuSettings = {
        delegate: "span.fancytree-title",
        autoFocus: true,
        menu: [
            {title: "Insert note here", cmd: "insertNoteHere", uiIcon: "ui-icon-pencil"},
            {title: "Insert child note", cmd: "insertChildNote", uiIcon: "ui-icon-pencil"},
            {title: "Delete", cmd: "delete", uiIcon: "ui-icon-trash"},
            {title: "----"},
            {title: "Protect sub-tree", cmd: "protectSubTree", uiIcon: "ui-icon-locked"},
            {title: "Unprotect sub-tree", cmd: "unprotectSubTree", uiIcon: "ui-icon-unlocked"},
            {title: "----"},
            {title: "Cut", cmd: "cut", uiIcon: "ui-icon-scissors"},
            {title: "Copy / clone", cmd: "copy", uiIcon: "ui-icon-copy"},
            {title: "Paste after", cmd: "pasteAfter", uiIcon: "ui-icon-clipboard"},
            {title: "Paste into", cmd: "pasteInto", uiIcon: "ui-icon-clipboard"}
        ],
        beforeOpen: (event, ui) => {
            const node = $.ui.fancytree.getNode(ui.target);
            // Modify menu entries depending on node status
            treeEl.contextmenu("enableEntry", "pasteAfter", noteTree.getClipboardNoteTreeId() !== null);
            treeEl.contextmenu("enableEntry", "pasteInto", noteTree.getClipboardNoteTreeId() !== null);

            // Activate node on right-click
            node.setActive();
            // Disable tree keyboard handling
            ui.menu.prevKeyboard = node.tree.options.keyboard;
            node.tree.options.keyboard = false;
        },
        close: (event, ui) => {},
        select: (event, ui) => {
            const node = $.ui.fancytree.getNode(ui.target);

            if (ui.cmd === "insertNoteHere") {
                const parentNoteTreeId = treeUtils.getParentNoteTreeId(node);
                const isProtected = treeUtils.getParentProtectedStatus(node);

                noteEditor.createNote(node, parentNoteTreeId, 'after', isProtected);
            }
            else if (ui.cmd === "insertChildNote") {
                noteEditor.createNote(node, node.data.note_id, 'into');
            }
            else if (ui.cmd === "protectSubTree") {
                protected_session.protectSubTree(node.data.note_id, true);
            }
            else if (ui.cmd === "unprotectSubTree") {
                protected_session.protectSubTree(node.data.note_id, false);
            }
            else if (ui.cmd === "cut") {
                cut(node);
            }
            else if (ui.cmd === "pasteAfter") {
                pasteAfter(node);
            }
            else if (ui.cmd === "pasteInto") {
                pasteInto(node);
            }
            else if (ui.cmd === "delete") {
                treeChanges.deleteNode(node);
            }
            else {
                console.log("Unknown command: " + ui.cmd);
            }
        }
    };

    return {
        pasteAfter,
        pasteInto,
        cut,
        contextMenuSettings
    }
})();