"use strict";

const contextMenu = (function() {
    const treeEl = $("#tree");

    function pasteAfter(node) {
        const subjectNode = getNodeByKey(noteTree.getClipboardNoteId());

        treeChanges.moveAfterNode(subjectNode, node);

        noteTree.setClipboardNoteId(null);
    }

    function pasteInto(node) {
        const subjectNode = getNodeByKey(noteTree.getClipboardNoteId());

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
            {title: "Encrypt sub-tree", cmd: "encryptSubTree", uiIcon: "ui-icon-locked"},
            {title: "Decrypt sub-tree", cmd: "decryptSubTree", uiIcon: "ui-icon-unlocked"},
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
                const parentKey = getParentKey(node);
                const encryption = getParentEncryption(node);

                noteEditor.createNote(node, parentKey, 'after', encryption);
            }
            else if (ui.cmd === "insertChildNote") {
                noteEditor.createNote(node, node.key, 'into');
            }
            else if (ui.cmd === "encryptSubTree") {
                encryption.encryptSubTree(node.key);
            }
            else if (ui.cmd === "decryptSubTree") {
                encryption.decryptSubTree(node.key);
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