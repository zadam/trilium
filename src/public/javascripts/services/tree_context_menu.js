import treeService from './tree.js';
import cloningService from './cloning.js';
import exportService from './export.js';
import messagingService from './messaging.js';
import protectedSessionService from './protected_session.js';
import treeChangesService from './branches.js';
import treeUtils from './tree_utils.js';
import branchPrefixDialog from '../dialogs/branch_prefix.js';
import exportDialog from '../dialogs/export.js';
import infoService from "./info.js";
import treeCache from "./tree_cache.js";
import syncService from "./sync.js";
import hoistedNoteService from './hoisted_note.js';
import ContextMenuItemsContainer from './context_menu_items_container.js';

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
    {title: "Insert note after <kbd>Ctrl+O</kbd>", cmd: "insertNoteAfter", uiIcon: "plus"},
    {title: "Insert child note <kbd>Ctrl+P</kbd>", cmd: "insertChildNote", uiIcon: "plus"},
    {title: "Delete <kbd>Delete</kbd>", cmd: "delete", uiIcon: "trash"},
    {title: "----"},
    {title: "Hoist note <kbd>Ctrl-H</kbd>", cmd: "hoist", uiIcon: "arrow-up"},
    {title: "Unhoist note <kbd>Ctrl-H</kbd>", cmd: "unhoist", uiIcon: "arrow-up"},
    {title: "Edit branch prefix <kbd>F2</kbd>", cmd: "editBranchPrefix", uiIcon: "pencil"},
    {title: "----"},
    {title: "Protect subtree", cmd: "protectSubtree", uiIcon: "shield-check"},
    {title: "Unprotect subtree", cmd: "unprotectSubtree", uiIcon: "shield-close"},
    {title: "----"},
    {title: "Copy / clone <kbd>Ctrl+C</kbd>", cmd: "copy", uiIcon: "files"},
    {title: "Cut <kbd>Ctrl+X</kbd>", cmd: "cut", uiIcon: "scissors"},
    {title: "Paste into <kbd>Ctrl+V</kbd>", cmd: "pasteInto", uiIcon: "clipboard"},
    {title: "Paste after", cmd: "pasteAfter", uiIcon: "clipboard"},
    {title: "----"},
    {title: "Export", cmd: "export", uiIcon: "arrow-up-right"},
    {title: "Import into note (tar, opml, md, enex)", cmd: "importIntoNote", uiIcon: "arrow-down-left"},
    {title: "----"},
    {title: "Collapse subtree <kbd>Alt+-</kbd>", cmd: "collapseSubtree", uiIcon: "align-justify"},
    {title: "Force note sync", cmd: "forceNoteSync", uiIcon: "refresh"},
    {title: "Sort alphabetically <kbd>Alt+S</kbd>", cmd: "sortAlphabetically", uiIcon: "arrows-v"}
];

async function getContextMenuItems(event) {
    const node = $.ui.fancytree.getNode(event);
    const branch = await treeCache.getBranch(node.data.branchId);
    const note = await treeCache.getNote(node.data.noteId);
    const parentNote = await treeCache.getNote(branch.parentNoteId);
    const isNotRoot = note.noteId !== 'root';
    const isHoisted = note.noteId === await hoistedNoteService.getHoistedNoteId();

    const itemsContainer = new ContextMenuItemsContainer(contextMenuItems);

    // Modify menu entries depending on node status
    itemsContainer.enableItem("insertNoteAfter", isNotRoot && !isHoisted && parentNote.type !== 'search');
    itemsContainer.enableItem("insertChildNote", note.type !== 'search');
    itemsContainer.enableItem("delete", isNotRoot && parentNote.type !== 'search');
    itemsContainer.enableItem("copy", isNotRoot);
    itemsContainer.enableItem("cut", isNotRoot);
    itemsContainer.enableItem("pasteAfter", clipboardIds.length > 0 && isNotRoot && parentNote.type !== 'search');
    itemsContainer.enableItem("pasteInto", clipboardIds.length > 0 && note.type !== 'search');
    itemsContainer.enableItem("importIntoNote", note.type !== 'search');
    itemsContainer.enableItem("export", note.type !== 'search');
    itemsContainer.enableItem("editBranchPrefix", isNotRoot && parentNote.type !== 'search');

    itemsContainer.hideItem("hoist", isHoisted);
    itemsContainer.hideItem("unhoist", !isHoisted || !isNotRoot);

    // Activate node on right-click
    node.setActive();

    // right click resets selection to just this node
    // this is important when e.g. you right click on a note while having different note active
    // and then click on delete - obviously you want to delete only that one right-clicked
    node.setSelected(true);
    treeService.clearSelectedNodes();

    return itemsContainer;
}

function selectContextMenuItem(event, cmd) {
    // context menu is always triggered on current node
    const node = treeService.getCurrentNode();

    if (cmd === "insertNoteAfter") {
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
    else if (cmd === "export") {
        exportDialog.showDialog("subtree");
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