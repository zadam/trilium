import treeService from './tree.js';
import cloningService from './cloning.js';
import messagingService from './messaging.js';
import protectedSessionService from './protected_session.js';
import treeChangesService from './branches.js';
import treeUtils from './tree_utils.js';
import branchPrefixDialog from '../dialogs/branch_prefix.js';
import exportDialog from '../dialogs/export.js';
import importDialog from '../dialogs/import.js';
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import syncService from "./sync.js";
import hoistedNoteService from './hoisted_note.js';

let clipboardIds = [];
let clipboardMode = null;

async function pasteAfter(node) {
    if (clipboardMode === 'cut') {
        const nodes = clipboardIds.map(nodeKey => treeUtils.getNodeByKey(nodeKey));

        await treeChangesService.moveAfterNode(nodes, node);

        clipboardIds = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        for (const noteId of clipboardIds) {
            await cloningService.cloneNoteAfter(noteId, node.data.branchId);
        }

        // copy will keep clipboardIds and clipboardMode so it's possible to paste into multiple places
    }
    else if (clipboardIds.length === 0) {
        // just do nothing
    }
    else {
        infoService.throwError("Unrecognized clipboard mode=" + clipboardMode);
    }
}

async function pasteInto(node) {
    if (clipboardMode === 'cut') {
        const nodes = clipboardIds.map(nodeKey => treeUtils.getNodeByKey(nodeKey));

        await treeChangesService.moveToNode(nodes, node);

        await node.setExpanded(true);

        clipboardIds = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        for (const noteId of clipboardIds) {
            await cloningService.cloneNoteTo(noteId, node.data.noteId);
        }

        await node.setExpanded(true);

        // copy will keep clipboardIds and clipboardMode so it's possible to paste into multiple places
    }
    else if (clipboardIds.length === 0) {
        // just do nothing
    }
    else {
        infoService.throwError("Unrecognized clipboard mode=" + mode);
    }
}

function copy(nodes) {
    clipboardIds = nodes.map(node => node.data.noteId);
    clipboardMode = 'copy';

    infoService.showMessage("Note(s) have been copied into clipboard.");
}

function cut(nodes) {
    clipboardIds = nodes.map(node => node.key);
    clipboardMode = 'cut';

    infoService.showMessage("Note(s) have been cut into clipboard.");
}

function getNoteTypeItems(baseCmd) {
    return [
        { title: "Text", cmd: baseCmd + "_text", uiIcon: "file" },
        { title: "Code", cmd: baseCmd + "_code", uiIcon: "terminal" },
        { title: "Saved search", cmd: baseCmd + "_search", uiIcon: "search-folder" },
        { title: "Relation Map", cmd: baseCmd + "_relation-map", uiIcon: "map" },
        { title: "Render HTML note", cmd: baseCmd + "_render", uiIcon: "play" }
    ];
}

async function getTopLevelItems(event) {
    const node = $.ui.fancytree.getNode(event);
    const branch = await treeCache.getBranch(node.data.branchId);
    const note = await treeCache.getNote(node.data.noteId);
    const parentNote = await treeCache.getNote(branch.parentNoteId);
    const isNotRoot = note.noteId !== 'root';
    const isHoisted = note.noteId === await hoistedNoteService.getHoistedNoteId();

    const insertNoteAfterEnabled = isNotRoot && !isHoisted && parentNote.type !== 'search';
    const insertChildNoteEnabled = note.type !== 'search';

    return [
        { title: "Insert note after <kbd>Ctrl+O</kbd>", cmd: "insertNoteAfter", uiIcon: "plus",
            items: insertNoteAfterEnabled ? getNoteTypeItems("insertNoteAfter") : null,
            enabled: insertNoteAfterEnabled },
        { title: "Insert child note <kbd>Ctrl+P</kbd>", cmd: "insertChildNote", uiIcon: "plus",
            items: insertChildNoteEnabled ? getNoteTypeItems("insertChildNote") : null,
            enabled: insertChildNoteEnabled },
        { title: "Delete <kbd>Delete</kbd>", cmd: "delete", uiIcon: "trash",
            enabled: isNotRoot && parentNote.type !== 'search' },
        { title: "----" },
        isHoisted ? null : { title: "Hoist note <kbd>Ctrl-H</kbd>", cmd: "hoist", uiIcon: "empty" },
        !isHoisted || !isNotRoot ? null : { title: "Unhoist note <kbd>Ctrl-H</kbd>", cmd: "unhoist", uiIcon: "arrow-up" },
        { title: "Edit branch prefix <kbd>F2</kbd>", cmd: "editBranchPrefix", uiIcon: "empty",
            enabled: isNotRoot && parentNote.type !== 'search'},
        { title: "----" },
        { title: "Protect subtree", cmd: "protectSubtree", uiIcon: "shield-check" },
        { title: "Unprotect subtree", cmd: "unprotectSubtree", uiIcon: "shield-close" },
        { title: "----" },
        { title: "Copy / clone <kbd>Ctrl+C</kbd>", cmd: "copy", uiIcon: "files",
            enabled: isNotRoot },
        { title: "Cut <kbd>Ctrl+X</kbd>", cmd: "cut", uiIcon: "scissors",
            enabled: isNotRoot },
        { title: "Paste into <kbd>Ctrl+V</kbd>", cmd: "pasteInto", uiIcon: "clipboard",
            enabled: clipboardIds.length > 0 && note.type !== 'search' },
        { title: "Paste after", cmd: "pasteAfter", uiIcon: "clipboard",
            enabled: clipboardIds.length > 0 && isNotRoot && parentNote.type !== 'search' },
        { title: "----" },
        { title: "Export", cmd: "export", uiIcon: "empty",
            enabled: note.type !== 'search' },
        { title: "Import into note", cmd: "importIntoNote", uiIcon: "empty",
            enabled: note.type !== 'search' },
        { title: "----" },
        { title: "Collapse subtree <kbd>Alt+-</kbd>", cmd: "collapseSubtree", uiIcon: "align-justify" },
        { title: "Force note sync", cmd: "forceNoteSync", uiIcon: "refresh" },
        { title: "Sort alphabetically <kbd>Alt+S</kbd>", cmd: "sortAlphabetically", uiIcon: "empty" }
    ].filter(row => row !== null);
}

async function getContextMenuItems(event) {
    const items = await getTopLevelItems(event);

    // Activate node on right-click
    const node = $.ui.fancytree.getNode(event);
    node.setActive();

    // right click resets selection to just this node
    // this is important when e.g. you right click on a note while having different note active
    // and then click on delete - obviously you want to delete only that one right-clicked
    node.setSelected(true);
    treeService.clearSelectedNodes();

    return items;
}

function selectContextMenuItem(event, cmd) {
    // context menu is always triggered on current node
    const node = treeService.getActiveNode();

    if (cmd.startsWith("insertNoteAfter")) {
        const parentNoteId = node.data.parentNoteId;
        const isProtected = treeUtils.getParentProtectedStatus(node);
        const type = cmd.split("_")[1];

        treeService.createNote(node, parentNoteId, 'after', {
            type: type,
            isProtected: isProtected
        });
    }
    else if (cmd.startsWith("insertChildNote")) {
        const type = cmd.split("_")[1];

        treeService.createNote(node, node.data.noteId, 'into', {
            type: type,
            isProtected: node.data.isProtected
        });
    }
    else if (cmd === "editBranchPrefix") {
        branchPrefixDialog.showDialog(node);
    }
    else if (cmd === "protectSubtree") {
        protectedSessionService.protectSubtree(node.data.noteId, true);
    }
    else if (cmd === "unprotectSubtree") {
        protectedSessionService.protectSubtree(node.data.noteId, false);
    }
    else if (cmd === "copy") {
        copy(treeService.getSelectedNodes());
    }
    else if (cmd === "cut") {
        cut(treeService.getSelectedNodes());
    }
    else if (cmd === "pasteAfter") {
        pasteAfter(node);
    }
    else if (cmd === "pasteInto") {
        pasteInto(node);
    }
    else if (cmd === "delete") {
        treeChangesService.deleteNodes(treeService.getSelectedNodes(true));
    }
    else if (cmd === "export") {
        exportDialog.showDialog("subtree");
    }
    else if (cmd === "importIntoNote") {
        importDialog.showDialog();
    }
    else if (cmd === "collapseSubtree") {
        treeService.collapseTree(node);
    }
    else if (cmd === "forceNoteSync") {
        syncService.forceNoteSync(node.data.noteId);
    }
    else if (cmd === "sortAlphabetically") {
        treeService.sortAlphabetically(node.data.noteId);
    }
    else if (cmd === "hoist") {
        hoistedNoteService.setHoistedNoteId(node.data.noteId);
    }
    else if (cmd === "unhoist") {
        hoistedNoteService.unhoist();
    }
    else {
        messagingService.logError("Unknown command: " + cmd);
    }
}

export default {
    pasteAfter,
    pasteInto,
    cut,
    copy,
    getContextMenuItems,
    selectContextMenuItem
};