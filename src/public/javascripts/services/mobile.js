import treeService from "./tree.js";
import noteDetailService from "./note_detail.js";
import dragAndDropSetup from "./drag_and_drop.js";
import treeCache from "./tree_cache.js";
import treeBuilder from "./tree_builder.js";

const $tree = $("#tree");
const $detail = $("#detail");

$detail.on('hide.bs.modal', e => {
   $tree.show();
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

            treeService.setCurrentNotePathToHash(node);

            noteDetailService.switchToNote(noteId, true);

            $tree.hide();

            $detail.modal();
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

showTree();