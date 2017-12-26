"use strict";

const contextMenu = (function() {
    const treeEl = $("#tree");

    let clipboardId = null;
    let clipboardMode = null;

    function pasteAfter(node) {
        if (clipboardMode === 'cut') {
            const subjectNode = treeUtils.getNodeByKey(clipboardId);

            treeChanges.moveAfterNode(subjectNode, node);
        }
        else if (clipboardMode === 'copy') {
            treeChanges.cloneNoteAfter(clipboardId, node.data.note_tree_id);
        }
        else if (clipboardId === null) {
            // just do nothing
        }
        else {
            throwError("Unrecognized clipboard mode=" + clipboardMode);
        }

        clipboardId = null;
        clipboardMode = null;
    }

    function pasteInto(node) {
        if (clipboardMode === 'cut') {
            const subjectNode = treeUtils.getNodeByKey(clipboardId);

            treeChanges.moveToNode(subjectNode, node);
        }
        else if (clipboardMode === 'copy') {
            treeChanges.cloneNoteTo(clipboardId, node.data.note_id);
        }
        else {
            throwError("Unrecognized clipboard mode=" + mode);
        }

        clipboardId = null;
        clipboardMode = null;
    }

    function copy(node) {
        clipboardId = node.data.note_id;
        clipboardMode = 'copy';
    }

    function cut(node) {
        clipboardId = node.key;
        clipboardMode = 'cut';
    }

    const contextMenuSettings = {
        delegate: "span.fancytree-title",
        autoFocus: true,
        menu: [
            {title: "Insert note here <kbd>Ctrl+O</kbd>", cmd: "insertNoteHere", uiIcon: "ui-icon-plus"},
            {title: "Insert child note <kbd>Ctrl+P</kbd>", cmd: "insertChildNote", uiIcon: "ui-icon-plus"},
            {title: "Delete <kbd>Ctrl+Del</kbd>", cmd: "delete", uiIcon: "ui-icon-trash"},
            {title: "----"},
            {title: "Edit tree prefix <kbd>F2</kbd>", cmd: "editTreePrefix", uiIcon: "ui-icon-pencil"},
            {title: "----"},
            {title: "Protect sub-tree", cmd: "protectSubTree", uiIcon: "ui-icon-locked"},
            {title: "Unprotect sub-tree", cmd: "unprotectSubTree", uiIcon: "ui-icon-unlocked"},
            {title: "----"},
            {title: "Copy / clone <kbd>Ctrl+C</kbd>", cmd: "copy", uiIcon: "ui-icon-copy"},
            {title: "Cut <kbd>Ctrl+X</kbd>", cmd: "cut", uiIcon: "ui-icon-scissors"},
            {title: "Paste into <kbd>Ctrl+V</kbd>", cmd: "pasteInto", uiIcon: "ui-icon-clipboard"},
            {title: "Paste after", cmd: "pasteAfter", uiIcon: "ui-icon-clipboard"},
            {title: "----"},
            {title: "Collapse sub-tree <kbd>Alt+-</kbd>", cmd: "collapse-sub-tree", uiIcon: "ui-icon-minus"}
        ],
        beforeOpen: (event, ui) => {
            const node = $.ui.fancytree.getNode(ui.target);
            // Modify menu entries depending on node status
            treeEl.contextmenu("enableEntry", "pasteAfter", clipboardId !== null);
            treeEl.contextmenu("enableEntry", "pasteInto", clipboardId !== null);

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
                const parentNoteId = node.data.parent_note_id;
                const isProtected = treeUtils.getParentProtectedStatus(node);

                noteTree.createNote(node, parentNoteId, 'after', isProtected);
            }
            else if (ui.cmd === "insertChildNote") {
                noteTree.createNote(node, node.data.note_id, 'into');
            }
            else if (ui.cmd === "editTreePrefix") {
                editTreePrefix.showDialog(node);
            }
            else if (ui.cmd === "protectSubTree") {
                protected_session.protectSubTree(node.data.note_id, true);
            }
            else if (ui.cmd === "unprotectSubTree") {
                protected_session.protectSubTree(node.data.note_id, false);
            }
            else if (ui.cmd === "copy") {
                copy(node);
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
            else if (ui.cmd === "collapse-sub-tree") {
                noteTree.collapseTree(node);
            }
            else {
                messaging.logError("Unknown command: " + ui.cmd);
            }
        }
    };

    return {
        pasteAfter,
        pasteInto,
        cut,
        copy,
        contextMenuSettings
    }
})();