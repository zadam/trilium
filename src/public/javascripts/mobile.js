import treeService from "./services/tree.js";
import noteDetailService from "./services/note_detail.js";
import dragAndDropSetup from "./services/drag_and_drop.js";
import treeCache from "./services/tree_cache.js";
import treeBuilder from "./services/tree_builder.js";
import contextMenuWidget from "./services/context_menu.js";
import ContextMenuItemsContainer from "./services/context_menu_items_container.js";
import treeChangesService from "./services/branches.js";
import utils from "./services/utils.js";
import treeUtils from "./services/tree_utils.js";

const $leftPane = $("#left-pane");
const $tree = $("#tree");
const $detail = $("#detail");
const $closeDetailButton = $("#close-detail-button");

function togglePanes() {
    if (!$leftPane.is(":visible") || !$detail.is(":visible")) {
        $detail.toggleClass("d-none");
        $leftPane.toggleClass("d-none");
    }
}

function showDetailPane() {
    if (!$detail.is(":visible")) {
        $detail.removeClass("d-none");
        $leftPane.addClass("d-none");
    }
}

$closeDetailButton.click(() => {
    // no page is opened
    document.location.hash = '-';

    togglePanes();
});

async function showTree() {
    const tree = await treeService.loadTree();

    $tree.fancytree({
        autoScroll: true,
        extensions: ["dnd5", "clones"],
        source: tree,
        scrollParent: $tree,
        minExpandLevel: 2, // root can't be collapsed
        activate: (event, data) => {
            const node = data.node;
            const noteId = node.data.noteId;

            treeService.clearSelectedNodes();

            treeService.setCurrentNotePathToHash(node);

            showDetailPane();

            noteDetailService.switchToNote(noteId, true);
        },
        expand: (event, data) => treeService.setExpandedToServer(data.node.data.branchId, true),
        collapse: (event, data) => treeService.setExpandedToServer(data.node.data.branchId, false),
        init: (event, data) => treeService.treeInitialized(), // don't collapse to short form
        dnd5: dragAndDropSetup,
        lazyLoad: function(event, data) {
            const noteId = data.node.data.noteId;

            data.result = treeCache.getNote(noteId).then(note => treeBuilder.prepareBranch(note));
        },
        clones: {
            highlightActiveClones: true
        }
    });
}

$("#note-menu-button").click(async e => {
    const node = treeService.getCurrentNode();
    const branch = await treeCache.getBranch(node.data.branchId);
    const note = await treeCache.getNote(node.data.noteId);
    const parentNote = await treeCache.getNote(branch.parentNoteId);
    const isNotRoot = note.noteId !== 'root';

    const itemsContainer = new ContextMenuItemsContainer([
        {title: "Insert note after", cmd: "insertNoteAfter", uiIcon: "plus"},
        {title: "Insert child note", cmd: "insertChildNote", uiIcon: "plus"},
        {title: "Delete this note", cmd: "delete", uiIcon: "trash"}
    ]);

    itemsContainer.enableItem("insertNoteAfter", isNotRoot && parentNote.type !== 'search');
    itemsContainer.enableItem("insertChildNote", note.type !== 'search');
    itemsContainer.enableItem("delete", isNotRoot && parentNote.type !== 'search');

    contextMenuWidget.initContextMenu(e, itemsContainer, (event, cmd) => {
        if (cmd === "insertNoteAfter") {
            const parentNoteId = node.data.parentNoteId;
            const isProtected = treeUtils.getParentProtectedStatus(node);

            treeService.createNote(node, parentNoteId, 'after', isProtected);
        }
        else if (cmd === "insertChildNote") {
            treeService.createNote(node, node.data.noteId, 'into');
        }
        else if (cmd === "delete") {
            treeChangesService.deleteNodes([node]);

            // move to the tree
            togglePanes();
        }
        else {
            throw new Error("Unrecognized command " + cmd);
        }
    });
});

$("#switch-to-desktop-button").click(() => {
    utils.setCookie('trilium-device', 'desktop');

    utils.reloadApp();
});

$("#log-out-button").click(() => {
    $("#logout-form").submit();
});

// this is done so that startNotePath is not used
if (!document.location.hash) {
    document.location.hash = '-';
}

showTree();