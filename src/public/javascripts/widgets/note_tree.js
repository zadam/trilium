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
import treeCache from "../services/tree_cache.js";
import treeBuilder from "../services/tree_builder.js";
import TreeContextMenu from "../services/tree_context_menu.js";
import treeChangesService from "../services/branches.js";

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
                keydown: await treeKeyBindingService.getKeyboardBindings(this)
            },
            dnd5: {
                autoExpandMS: 600,
                dragStart: (node, data) => {
                    // don't allow dragging root node
                    if (node.data.noteId === hoistedNoteService.getHoistedNoteNoPromise()
                        || node.getParent().data.noteType === 'search') {
                        return false;
                    }

                    node.setSelected(true);

                    const notes = this.getSelectedNodes().map(node => { return {
                        noteId: node.data.noteId,
                        title: node.title
                    }});

                    data.dataTransfer.setData("text", JSON.stringify(notes));

                    // This function MUST be defined to enable dragging for the tree.
                    // Return false to cancel dragging of node.
                    return true;
                },
                dragEnter: (node, data) => true, // allow drop on any node
                dragOver: (node, data) => true,
                dragDrop: async (node, data) => {
                    if ((data.hitMode === 'over' && node.data.noteType === 'search') ||
                        (['after', 'before'].includes(data.hitMode)
                            && (node.data.noteId === hoistedNoteService.getHoistedNoteNoPromise() || node.getParent().data.noteType === 'search'))) {

                        const infoDialog = await import('../dialogs/info.js');

                        await infoDialog.info("Dropping notes into this location is not allowed.");

                        return;
                    }

                    const dataTransfer = data.dataTransfer;

                    if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
                        const files = [...dataTransfer.files]; // chrome has issue that dataTransfer.files empties after async operation

                        const importService = await import('./import.js');

                        importService.uploadFiles(node.data.noteId, files, {
                            safeImport: true,
                            shrinkImages: true,
                            textImportedAsText: true,
                            codeImportedAsCode: true,
                            explodeArchives: true
                        });
                    }
                    else {
                        // This function MUST be defined to enable dropping of items on the tree.
                        // data.hitMode is 'before', 'after', or 'over'.

                        const selectedBranchIds = this.getSelectedNodes().map(node => node.data.branchId);

                        if (data.hitMode === "before") {
                            treeChangesService.moveBeforeNode(selectedBranchIds, node.data.branchId);
                        } else if (data.hitMode === "after") {
                            treeChangesService.moveAfterNode(selectedBranchIds, node.data.branchId);
                        } else if (data.hitMode === "over") {
                            treeChangesService.moveToNode(selectedBranchIds, node.data.noteId);
                        } else {
                            throw new Error("Unknown hitMode=" + data.hitMode);
                        }
                    }
                }
            },
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

            contextMenuWidget.initContextMenu(e, new TreeContextMenu(this, node));

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

    /**
     * focused & not active node can happen during multiselection where the node is selected but not activated
     * (its content is not displayed in the detail)
     * @return {FancytreeNode|null}
     */
    getFocusedNode() {
        return this.tree.getFocusNode();
    }

    clearSelectedNodes() {
        for (const selectedNode of this.getSelectedNodes()) {
            selectedNode.setSelected(false);
        }
    }

    createTopLevelNoteListener() { treeService.createNewTopLevelNote(); }

    collapseTreeListener() { this.collapseTree(); }

    scrollToActiveNoteListener() { treeService.scrollToActiveNote(); }
}