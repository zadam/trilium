import treeService from "./services/tree.js";
import treeCache from "./services/tree_cache.js";
import treeBuilder from "./services/tree_builder.js";
import contextMenuWidget from "./services/context_menu.js";
import treeChangesService from "./services/branches.js";
import utils from "./services/utils.js";
import appContext from "./services/app_context.js";

window.glob.isDesktop = utils.isDesktop;
window.glob.isMobile = utils.isMobile;

const $leftPane = $("#left-pane");
const $tree = $("#tree");
const $detail = $("#detail");

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

$detail.on("click", ".close-detail-button",() => {
    // no page is opened
    document.location.hash = '-';

    togglePanes();
});

async function showTree() {
    const treeData = await treeBuilder.prepareTree();

    $tree.fancytree({
        autoScroll: true,
        extensions: ["dnd5", "clones"],
        source: treeData,
        scrollParent: $tree,
        minExpandLevel: 2, // root can't be collapsed
        click: (event, data) => {
            if (data.targetType !== 'expander' && data.node.isActive()) {
                // this is important for single column mobile view, otherwise it's not possible to see again previously displayed note
                $tree.fancytree('getTree').reactivate(true);

                return false;
            }
        },
        activate: async (event, data) => {
            const node = data.node;

            treeService.clearSelectedNodes();

            showDetailPane();

            const notePath = await treeService.getNotePath(node);

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
        // this is done to automatically lazy load all expanded search notes after tree load
        loadChildren: (event, data) => {
            data.node.visit((subNode) => {
                // Load all lazy/unloaded child nodes
                // (which will trigger `loadChildren` recursively)
                if (subNode.isUndefined() && subNode.isExpanded()) {
                    subNode.load();
                }
            });
        }
    });

    treeService.setTree($.ui.fancytree.getTree("#tree"));
}

$detail.on("click", ".note-menu-button", async e => {
    const node = appContext.getMainNoteTree().getActiveNode();
    const branch = treeCache.getBranch(node.data.branchId);
    const note = await treeCache.getNote(node.data.noteId);
    const parentNote = await treeCache.getNote(branch.parentNoteId);
    const isNotRoot = note.noteId !== 'root';

    const items = [
        { title: "Insert note after", cmd: "insertNoteAfter", uiIcon: "plus",
            enabled: isNotRoot && parentNote.type !== 'search' },
        { title: "Insert child note", cmd: "insertChildNote", uiIcon: "plus",
            enabled: note.type !== 'search' },
        { title: "Delete this note", cmd: "delete", uiIcon: "trash",
            enabled: isNotRoot && parentNote.type !== 'search' }
    ];

    contextMenuWidget.initContextMenu(e, {
        getContextMenuItems: () => items,
        selectContextMenuItem: async (event, cmd) => {
            if (cmd === "insertNoteAfter") {
                const parentNoteId = node.data.parentNoteId;
                const isProtected = await treeService.getParentProtectedStatus(node);

                treeService.createNote(node, parentNoteId, 'after', { isProtected: isProtected });
            }
            else if (cmd === "insertChildNote") {
                treeService.createNote(node, node.data.noteId, 'into');
            }
            else if (cmd === "delete") {
                if (await treeChangesService.deleteNodes([node])) {
                    // move to the tree
                    togglePanes();
                }
            }
            else {
                throw new Error("Unrecognized command " + cmd);
            }
        }
    });
});

$("#switch-to-desktop-button").on('click', () => {
    utils.setCookie('trilium-device', 'desktop');

    utils.reloadApp();
});

$("#log-out-button").on('click', () => {
    $("#logout-form").trigger('submit');
});

// this is done so that startNotePath is not used
if (!document.location.hash) {
    document.location.hash = '-';
}

showTree();