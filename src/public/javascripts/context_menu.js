"use strict";

const contextMenu = (function() {
    const $tree = $("#tree");

    let clipboardIds = [];
    let clipboardMode = null;

    async function pasteAfter(node) {
        if (clipboardMode === 'cut') {
            const nodes = clipboardIds.map(nodeKey => treeUtils.getNodeByKey(nodeKey));

            await treeChanges.moveAfterNode(nodes, node);

            clipboardIds = [];
            clipboardMode = null;
        }
        else if (clipboardMode === 'copy') {
            for (const noteId of clipboardIds) {
                await cloning.cloneNoteAfter(noteId, node.data.branchId);
            }

            // copy will keep clipboardIds and clipboardMode so it's possible to paste into multiple places
        }
        else if (clipboardIds.length === 0) {
            // just do nothing
        }
        else {
            utils.throwError("Unrecognized clipboard mode=" + clipboardMode);
        }
    }

    async function pasteInto(node) {
        if (clipboardMode === 'cut') {
            const nodes = clipboardIds.map(nodeKey => treeUtils.getNodeByKey(nodeKey));

            await treeChanges.moveToNode(nodes, node);

            clipboardIds = [];
            clipboardMode = null;
        }
        else if (clipboardMode === 'copy') {
            for (const noteId of clipboardIds) {
                await cloning.cloneNoteTo(noteId, node.data.noteId);
            }
            // copy will keep clipboardIds and clipboardMode so it's possible to paste into multiple places
        }
        else if (clipboardIds.length === 0) {
            // just do nothing
        }
        else {
            utils.throwError("Unrecognized clipboard mode=" + mode);
        }
    }

    function copy(nodes) {
        clipboardIds = nodes.map(node => node.data.noteId);
        clipboardMode = 'copy';

        utils.showMessage("Note(s) have been copied into clipboard.");
    }

    function cut(nodes) {
        clipboardIds = nodes.map(node => node.key);
        clipboardMode = 'cut';

        utils.showMessage("Note(s) have been cut into clipboard.");
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
            {title: "Export sub-tree", cmd: "exportSubTree", uiIcon: " ui-icon-arrowthick-1-ne"},
            {title: "Import sub-tree into", cmd: "importSubTree", uiIcon: "ui-icon-arrowthick-1-sw"},
            {title: "----"},
            {title: "Collapse sub-tree <kbd>Alt+-</kbd>", cmd: "collapseSubTree", uiIcon: "ui-icon-minus"},
            {title: "Force note sync", cmd: "forceNoteSync", uiIcon: "ui-icon-refresh"},
            {title: "Sort alphabetically <kbd>Alt+S</kbd>", cmd: "sortAlphabetically", uiIcon: " ui-icon-arrowthick-2-n-s"}

        ],
        beforeOpen: (event, ui) => {
            const node = $.ui.fancytree.getNode(ui.target);
            const branch = treeService.getBranch(node.data.branchId);
            const note = treeService.getNote(node.data.noteId);
            const parentNote = treeService.getNote(branch.parentNoteId);

            // Modify menu entries depending on node status
            $tree.contextmenu("enableEntry", "pasteAfter", clipboardIds.length > 0 && (!parentNote || parentNote.type !== 'search'));
            $tree.contextmenu("enableEntry", "pasteInto", clipboardIds.length > 0 && note.type !== 'search');
            $tree.contextmenu("enableEntry", "insertNoteHere", !parentNote || parentNote.type !== 'search');
            $tree.contextmenu("enableEntry", "insertChildNote", note.type !== 'search');
            $tree.contextmenu("enableEntry", "importSubTree", note.type !== 'search');
            $tree.contextmenu("enableEntry", "exportSubTree", note.type !== 'search');

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
                const parentNoteId = node.data.parentNoteId;
                const isProtected = treeUtils.getParentProtectedStatus(node);

                treeService.createNote(node, parentNoteId, 'after', isProtected);
            }
            else if (ui.cmd === "insertChildNote") {
                treeService.createNote(node, node.data.noteId, 'into');
            }
            else if (ui.cmd === "editTreePrefix") {
                editTreePrefix.showDialog(node);
            }
            else if (ui.cmd === "protectSubTree") {
                protected_session.protectSubTree(node.data.noteId, true);
            }
            else if (ui.cmd === "unprotectSubTree") {
                protected_session.protectSubTree(node.data.noteId, false);
            }
            else if (ui.cmd === "copy") {
                copy(treeService.getSelectedNodes());
            }
            else if (ui.cmd === "cut") {
                cut(treeService.getSelectedNodes());
            }
            else if (ui.cmd === "pasteAfter") {
                pasteAfter(node);
            }
            else if (ui.cmd === "pasteInto") {
                pasteInto(node);
            }
            else if (ui.cmd === "delete") {
                treeChanges.deleteNodes(treeService.getSelectedNodes(true));
            }
            else if (ui.cmd === "exportSubTree") {
                exportService.exportSubTree(node.data.noteId);
            }
            else if (ui.cmd === "importSubTree") {
                exportService.importSubTree(node.data.noteId);
            }
            else if (ui.cmd === "collapseSubTree") {
                treeService.collapseTree(node);
            }
            else if (ui.cmd === "forceNoteSync") {
                syncService.forceNoteSync(node.data.noteId);
            }
            else if (ui.cmd === "sortAlphabetically") {
                treeService.sortAlphabetically(node.data.noteId);
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