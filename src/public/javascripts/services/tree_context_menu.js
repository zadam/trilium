import treeService from './tree.js';
import cloningService from './cloning.js';
import exportService from './export.js';
import messagingService from './messaging.js';
import protectedSessionService from './protected_session.js';
import treeChangesService from './branches.js';
import treeUtils from './tree_utils.js';
import branchPrefixDialog from '../dialogs/branch_prefix.js';
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import syncService from "./sync.js";

const $tree = $("#tree");

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

        clipboardIds = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        for (const noteId of clipboardIds) {
            await cloningService.cloneNoteTo(noteId, node.data.noteId);
        }
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

const contextMenuItems = [
    {title: "Insert note here <kbd>Ctrl+O</kbd>", cmd: "insertNoteHere", uiIcon: "ui-icon-plus"},
    {title: "Insert child note <kbd>Ctrl+P</kbd>", cmd: "insertChildNote", uiIcon: "ui-icon-plus"},
    {title: "Delete", cmd: "delete", uiIcon: "ui-icon-trash"},
    {title: "----"},
    {title: "Edit branch prefix <kbd>F2</kbd>", cmd: "editBranchPrefix", uiIcon: "ui-icon-pencil"},
    {title: "----"},
    {title: "Protect subtree", cmd: "protectSubtree", uiIcon: "ui-icon-locked"},
    {title: "Unprotect subtree", cmd: "unprotectSubtree", uiIcon: "ui-icon-unlocked"},
    {title: "----"},
    {title: "Copy / clone <kbd>Ctrl+C</kbd>", cmd: "copy", uiIcon: "ui-icon-copy"},
    {title: "Cut <kbd>Ctrl+X</kbd>", cmd: "cut", uiIcon: "ui-icon-scissors"},
    {title: "Paste into <kbd>Ctrl+V</kbd>", cmd: "pasteInto", uiIcon: "ui-icon-clipboard"},
    {title: "Paste after", cmd: "pasteAfter", uiIcon: "ui-icon-clipboard"},
    {title: "----"},
    {title: "Export subtree", cmd: "exportSubtree", uiIcon: " ui-icon-arrowthick-1-ne"},
    {title: "Import into note (tar, opml, md, enex)", cmd: "importIntoNote", uiIcon: "ui-icon-arrowthick-1-sw"},
    {title: "----"},
    {title: "Collapse subtree <kbd>Alt+-</kbd>", cmd: "collapseSubtree", uiIcon: "ui-icon-minus"},
    {title: "Force note sync", cmd: "forceNoteSync", uiIcon: "ui-icon-refresh"},
    {title: "Sort alphabetically <kbd>Alt+S</kbd>", cmd: "sortAlphabetically", uiIcon: " ui-icon-arrowthick-2-n-s"}
];

function enableItem(cmd, enabled) {
    const item = contextMenuItems.find(item => item.cmd === cmd);
    
    if (!item) {
        throw new Error(`Command ${cmd} has not been found!`);
    }
    
    item.enabled = enabled;
}

async function getContextMenuItems(event) {
    const node = $.ui.fancytree.getNode(event);
    const branch = await treeCache.getBranch(node.data.branchId);
    const note = await treeCache.getNote(node.data.noteId);
    const parentNote = await treeCache.getNote(branch.parentNoteId);
    const isNotRoot = note.noteId !== 'root';

    // Modify menu entries depending on node status
    enableItem("insertNoteHere", isNotRoot && parentNote.type !== 'search');
    enableItem("insertChildNote", note.type !== 'search');
    enableItem("delete", isNotRoot && parentNote.type !== 'search');
    enableItem("copy", isNotRoot);
    enableItem("cut", isNotRoot);
    enableItem("pasteAfter", clipboardIds.length > 0 && isNotRoot && parentNote.type !== 'search');
    enableItem("pasteInto", clipboardIds.length > 0 && note.type !== 'search');
    enableItem("importIntoNote", note.type !== 'search');
    enableItem("exportSubtree", note.type !== 'search');
    enableItem("editBranchPrefix", isNotRoot && parentNote.type !== 'search');

    // Activate node on right-click
    node.setActive();

    // right click resets selection to just this node
    // this is important when e.g. you right click on a note while having different note active
    // and then click on delete - obviously you want to delete only that one right-clicked
    node.setSelected(true);
    treeService.clearSelectedNodes();

    return contextMenuItems;
}

function selectContextMenuItem(event, cmd) {
    const node = $.ui.fancytree.getNode(event);

    if (cmd === "insertNoteHere") {
        const parentNoteId = node.data.parentNoteId;
        const isProtected = treeUtils.getParentProtectedStatus(node);

        treeService.createNote(node, parentNoteId, 'after', isProtected);
    }
    else if (cmd === "insertChildNote") {
        treeService.createNote(node, node.data.noteId, 'into');
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
    else if (cmd === "exportSubtreeToTar") {
        exportService.exportSubtree(node.data.branchId, 'tar');
    }
    else if (cmd === "exportSubtreeToOpml") {
        exportService.exportSubtree(node.data.branchId, 'opml');
    }
    else if (cmd === "exportSubtreeToMarkdown") {
        exportService.exportSubtree(node.data.branchId, 'markdown');
    }
    else if (cmd === "importIntoNote") {
        exportService.importIntoNote(node.data.noteId);
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