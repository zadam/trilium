import treeService from "./tree.js";
import noteDetailService from "./note_detail.js";
import dragAndDropSetup from "./drag_and_drop.js";
import treeCache from "./tree_cache.js";
import treeBuilder from "./tree_builder.js";

const $tree = $("#tree");
const $detail = $("#detail");
const $closeDetailButton = $("#close-detail-button");

function togglePanes() {
    if (!$tree.is(":visible") || !$detail.is(":visible")) {
        $detail.toggleClass("d-none");
        $tree.toggleClass("d-none");
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

showTree();