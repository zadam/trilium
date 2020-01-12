import BasicWidget from "./basic_widget.js";
import hoistedNoteService from "../services/hoisted_note.js";
import searchNotesService from "../services/search_notes.js";
import keyboardActionService from "../services/keyboard_actions.js";
import treeService from "../services/tree.js";
import treeUtils from "../services/tree_utils.js";
import noteDetailService from "../services/note_detail.js";
import utils from "../services/utils.js";
import contextMenuWidget from "../services/context_menu.js";
import treeKeyBindingService from "../services/tree_keybindings.js";
import dragAndDropSetup from "../services/drag_and_drop.js";
import treeCache from "../services/tree_cache.js";
import treeBuilder from "../services/tree_builder.js";
import TreeContextMenu from "../services/tree_context_menu.js";

const TPL = `
<style>
#tree {
    overflow: auto;
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: 60%;
    font-family: var(--tree-font-family);
    font-size: var(--tree-font-size);
}
</style>

<div id="tree"></div>
`;

export default class NoteTreeWidget extends BasicWidget {
    constructor(appContext) {
        super(appContext);

        this.tree = null;
    }

    async doRender($widget) {
        $widget.append($(TPL));

        const $tree = $widget.find('#tree');

        const treeData = await treeService.loadTreeData();

        await this.initFancyTree($tree, treeData);

        $tree.on("click", ".unhoist-button", hoistedNoteService.unhoist);
        $tree.on("click", ".refresh-search-button", searchNotesService.refreshSearch);

        // this does not belong here ...
        keyboardActionService.setGlobalActionHandler('CollapseTree', () => treeService.collapseTree()); // don't use shortened form since collapseTree() accepts argument

        // fancytree doesn't support middle click so this is a way to support it
        $widget.on('mousedown', '.fancytree-title', e => {
            if (e.which === 2) {
                const node = $.ui.fancytree.getNode(e);

                treeUtils.getNotePath(node).then(notePath => {
                    if (notePath) {
                        noteDetailService.openInTab(notePath, false);
                    }
                });

                e.stopPropagation();
                e.preventDefault();
            }
        });
    }

    async initFancyTree($tree, treeData) {
        utils.assertArguments(treeData);

        $tree.fancytree({
            autoScroll: true,
            keyboard: false, // we takover keyboard handling in the hotkeys plugin
            extensions: ["hotkeys", "dnd5", "clones"],
            source: treeData,
            scrollParent: $tree,
            minExpandLevel: 2, // root can't be collapsed
            click: (event, data) => {
                const targetType = data.targetType;
                const node = data.node;

                if (targetType === 'title' || targetType === 'icon') {
                    if (event.shiftKey) {
                        node.setSelected(!node.isSelected());
                        node.setFocus(true);
                    }
                    else if (event.ctrlKey) {
                        noteDetailService.loadNoteDetail(node.data.noteId, { newTab: true });
                    }
                    else {
                        node.setActive();

                        treeService.clearSelectedNodes();
                    }

                    return false;
                }
            },
            activate: async (event, data) => {
                // click event won't propagate so let's close context menu manually
                contextMenuWidget.hideContextMenu();

                const notePath = await treeUtils.getNotePath(data.node);

                noteDetailService.switchToNote(notePath);
            },
            expand: (event, data) => treeService.setExpandedToServer(data.node.data.branchId, true),
            collapse: (event, data) => treeService.setExpandedToServer(data.node.data.branchId, false),
            init: (event, data) => treeService.treeInitialized(),
            hotkeys: {
                keydown: await treeKeyBindingService.getKeyboardBindings()
            },
            dnd5: dragAndDropSetup,
            lazyLoad: function(event, data) {
                const noteId = data.node.data.noteId;

                data.result = treeCache.getNote(noteId).then(note => treeBuilder.prepareBranch(note));
            },
            clones: {
                highlightActiveClones: true
            },
            enhanceTitle: async function (event, data) {
                const node = data.node;
                const $span = $(node.span);

                if (node.data.noteId !== 'root'
                    && node.data.noteId === await hoistedNoteService.getHoistedNoteId()
                    && $span.find('.unhoist-button').length === 0) {

                    const unhoistButton = $('<span>&nbsp; (<a class="unhoist-button">unhoist</a>)</span>');

                    $span.append(unhoistButton);
                }

                const note = await treeCache.getNote(node.data.noteId);

                if (note.type === 'search' && $span.find('.refresh-search-button').length === 0) {
                    const refreshSearchButton = $('<span>&nbsp; <span class="refresh-search-button bx bx-recycle" title="Refresh saved search results"></span></span>');

                    $span.append(refreshSearchButton);
                }
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

        $tree.on('contextmenu', '.fancytree-node', e => {
            const node = $.ui.fancytree.getNode(e);

            contextMenuWidget.initContextMenu(this, e, new TreeContextMenu(this, node));

            return false; // blocks default browser right click menu
        });

        this.tree = $.ui.fancytree.getTree("#tree");

        treeService.setTree(this.tree);
    }

    /** @return {FancytreeNode[]} */
    getSelectedNodes(stopOnParents = false) {
        return this.tree.getSelectedNodes(stopOnParents);
    }

    /** @return {FancytreeNode[]} */
    getSelectedOrActiveNodes(node) {
        let notes = this.getSelectedNodes(true);

        if (notes.length === 0) {
            notes.push(node);
        }

        return notes;
    }

    async collapseTree(node = null) {
        if (!node) {
            const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

            node = getNodesByNoteId(hoistedNoteId)[0];
        }

        node.setExpanded(false);

        node.visit(node => node.setExpanded(false));
    }

    createTopLevelNoteListener() { treeService.createNewTopLevelNote(); }

    collapseTreeListener() { this.collapseTree(); }

    scrollToActiveNoteListener() { treeService.scrollToActiveNote(); }
}