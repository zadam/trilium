"use strict";

const contextMenu = (function() {
    const treeEl = $("#tree");

    function pasteAfter(node) {
        const subjectNode = treeUtils.getNodeByKey(noteTree.getClipboardNoteId());

        treeChanges.moveAfterNode(subjectNode, node);

        noteTree.setClipboardNoteId(null);
    }

    function pasteInto(node) {
        const subjectNode = treeUtils.getNodeByKey(noteTree.getClipboardNoteId());

        treeChanges.moveToNode(subjectNode, node);

        noteTree.setClipboardNoteId(null);
    }

    function cut(node) {
        noteTree.setClipboardNoteId(node.key);
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
            treeEl.contextmenu("enableEntry", "pasteAfter", noteTree.getClipboardNoteId() !== null);
            treeEl.contextmenu("enableEntry", "pasteInto", noteTree.getClipboardNoteId() !== null);

            treeEl.contextmenu("enableEntry", "protectSubTree", protected_session.isProtectedSessionAvailable());
            treeEl.contextmenu("enableEntry", "unprotectSubTree", protected_session.isProtectedSessionAvailable());

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
                const parentKey = treeUtils.getParentKey(node);
                const isProtected = treeUtils.getParentProtectedStatus(node);

                noteEditor.createNote(node, parentKey, 'after', isProtected);
            }
            else if (ui.cmd === "insertChildNote") {
                noteEditor.createNote(node, node.key, 'into');
            }
            else if (ui.cmd === "protectSubTree") {
                protected_session.protectSubTree(node.key, true);
            }
            else if (ui.cmd === "unprotectSubTree") {
                protected_session.protectSubTree(node.key, false);
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