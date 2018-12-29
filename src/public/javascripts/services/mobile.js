import treeService from "./tree.js";
import noteDetailService from "./note_detail.js";
import dragAndDropSetup from "./drag_and_drop.js";
import treeCache from "./tree_cache.js";
import treeBuilder from "./tree_builder.js";
import contextMenuWidget from "./context_menu.js";
import confirmDialog from "../dialogs/confirm.js";
import server from "./server.js";
import promptDialog from "../dialogs/prompt.js";
import ContextMenuItemsContainer from "./context_menu_items_container.js";
import treeChangesService from "./branches.js";
import utils from "./utils.js";

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

$closeDetailButton.click(togglePanes);

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
            togglePanes();

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
        },
        renderNode: function (event, data) {
            const node = data.node;
            const $nodeSpan = $(node.span);

            // check if span of node already rendered
            if (!$nodeSpan.data('rendered')) {
                const addNoteButton = $('<button class="action-button" title="Add new sub-note" type="button" class="btn">+</button>');

                addNoteButton.click(() => {
                    alert("Add new note");
                });

                $nodeSpan.append(addNoteButton);

                // span rendered
                $nodeSpan.data('rendered', true);
            }
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
        {title: "Delete note", cmd: "delete", uiIcon: "trash"}
    ]);

    itemsContainer.enableItem("delete", isNotRoot && parentNote.type !== 'search');
    alert("A");
    contextMenuWidget.initContextMenu(e, itemsContainer, (event, cmd) => {
        if (cmd === "delete") {
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

showTree();