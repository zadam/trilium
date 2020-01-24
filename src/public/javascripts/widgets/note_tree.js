import hoistedNoteService from "../services/hoisted_note.js";
import searchNotesService from "../services/search_notes.js";
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
import ws from "../services/ws.js";
import appContext from "../services/app_context.js";
import TabAwareWidget from "./tab_aware_widget.js";
import server from "../services/server.js";

const TPL = `
<div class="tree">
    <style>
    .tree {
        overflow: auto;
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: 60%;
        font-family: var(--tree-font-family);
        font-size: var(--tree-font-size);
    }
    </style>
</div>
`;

export default class NoteTreeWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        window.glob.cutIntoNote = () => this.cutIntoNoteListener();

        this.tree = null;
    }

    doRender() {
        const $widget = $(TPL);
        const $tree = $widget;

        $tree.on("click", ".unhoist-button", hoistedNoteService.unhoist);
        $tree.on("click", ".refresh-search-button", searchNotesService.refreshSearch);

        // fancytree doesn't support middle click so this is a way to support it
        $widget.on('mousedown', '.fancytree-title', e => {
            if (e.which === 2) {
                const node = $.ui.fancytree.getNode(e);

                treeUtils.getNotePath(node).then(notePath => {
                    if (notePath) {
                        const tabContext = appContext.openEmptyTab();
                        tabContext.setNote(notePath);
                    }
                });

                e.stopPropagation();
                e.preventDefault();
            }
        });

        treeService.loadTreeData().then(treeData => this.initFancyTree($tree, treeData));

        return $widget;
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
                        const tabContext = appContext.openEmptyTab();
                        treeUtils.getNotePath(node).then(notePath => tabContext.setNote(notePath));
                        appContext.activateTab(tabContext.tabId);
                    }
                    else {
                        node.setActive();

                        this.clearSelectedNodes();
                    }

                    return false;
                }
            },
            activate: async (event, data) => {
                // click event won't propagate so let's close context menu manually
                contextMenuWidget.hideContextMenu();

                const notePath = await treeUtils.getNotePath(data.node);

                this.appContext.activateNote(notePath);
            },
            expand: (event, data) => this.setExpandedToServer(data.node.data.branchId, true),
            collapse: (event, data) => this.setExpandedToServer(data.node.data.branchId, false),
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

                        const importService = await import('../services/import.js');

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

        this.tree = $.ui.fancytree.getTree($tree);
    }

    /** @return {FancytreeNode[]} */
    getSelectedNodes(stopOnParents = false) {
        return this.tree.getSelectedNodes(stopOnParents);
    }

    /** @return {FancytreeNode[]} */
    getSelectedOrActiveNodes(node = null) {
        let notes = this.getSelectedNodes(true);

        if (notes.length === 0) {
            notes.push(node ? node : this.getActiveNode());
        }

        return notes;
    }

    async collapseTree(node = null) {
        if (!node) {
            const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

            node = this.getNodesByNoteId(hoistedNoteId)[0];
        }

        node.setExpanded(false);

        node.visit(node => node.setExpanded(false));
    }

    /**
     * @return {FancytreeNode|null}
     */
    getActiveNode() {
        return this.tree.getActiveNode();
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

    async scrollToActiveNoteListener() {
        const activeContext = appContext.getActiveTabContext();

        if (activeContext && activeContext.notePath) {
            this.tree.setFocus();

            const node = await this.expandToNote(activeContext.notePath);

            await node.makeVisible({scrollIntoView: true});
            node.setFocus();
        }
    }

    /** @return {FancytreeNode} */
    async getNodeFromPath(notePath, expand = false, expandOpts = {}) {
        utils.assertArguments(notePath);

        const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();
        /** @var {FancytreeNode} */
        let parentNode = null;

        const runPath = await treeService.getRunPath(notePath);

        if (!runPath) {
            console.error("Could not find run path for notePath:", notePath);
            return;
        }

        for (const childNoteId of runPath) {
            if (childNoteId === hoistedNoteId) {
                // there must be exactly one node with given hoistedNoteId
                parentNode = this.getNodesByNoteId(childNoteId)[0];

                continue;
            }

            // we expand only after hoisted note since before then nodes are not actually present in the tree
            if (parentNode) {
                if (!parentNode.isLoaded()) {
                    await parentNode.load();
                }

                if (expand) {
                    await parentNode.setExpanded(true, expandOpts);
                }

                await this.checkFolderStatus(parentNode);

                let foundChildNode = this.findChildNode(parentNode, childNoteId);

                if (!foundChildNode) { // note might be recently created so we'll force reload and try again
                    await parentNode.load(true);

                    foundChildNode = this.findChildNode(parentNode, childNoteId);

                    if (!foundChildNode) {
                        ws.logError(`Can't find node for child node of noteId=${childNoteId} for parent of noteId=${parentNode.data.noteId} and hoistedNoteId=${hoistedNoteId}, requested path is ${notePath}`);
                        return;
                    }
                }

                parentNode = foundChildNode;
            }
        }

        return parentNode;
    }

    /** @return {FancytreeNode} */
    findChildNode(parentNode, childNoteId) {
        let foundChildNode = null;

        for (const childNode of parentNode.getChildren()) {
            if (childNode.data.noteId === childNoteId) {
                foundChildNode = childNode;
                break;
            }
        }

        return foundChildNode;
    }

    /** @return {FancytreeNode} */
    async expandToNote(notePath, expandOpts) {
        return this.getNodeFromPath(notePath, true, expandOpts);
    }

    async checkFolderStatus(node) {
        const note = await treeCache.getNote(node.data.noteId);

        node.folder = note.type === 'search' || note.getChildNoteIds().length > 0;
        node.icon = await treeBuilder.getIcon(note);
        node.extraClasses = await treeBuilder.getExtraClasses(note);
        node.renderTitle();
    }

    /** @return {FancytreeNode[]} */
    async getNodesByBranchId(branchId) {
        utils.assertArguments(branchId);

        const branch = treeCache.getBranch(branchId);

        return this.getNodesByNoteId(branch.noteId).filter(node => node.data.branchId === branchId);
    }

    /** @return {FancytreeNode[]} */
    getNodesByNoteId(noteId) {
        utils.assertArguments(noteId);

        const list = this.tree.getNodesByRef(noteId);
        return list ? list : []; // if no nodes with this refKey are found, fancy tree returns null
    }

    async reload(notes) {
        await this.tree.reload(notes);
    }

    createTopLevelNoteListener() { treeService.createNewTopLevelNote(); }

    collapseTreeListener() { this.collapseTree(); }

    async refresh() {
        const oldActiveNode = this.getActiveNode();

        if (oldActiveNode) {
            oldActiveNode.setActive(false);
            oldActiveNode.setFocus(false);
        }

        if (this.tabContext && this.tabContext.notePath) {
            const newActiveNode = await this.getNodeFromPath(this.tabContext.notePath);

            if (newActiveNode) {
                if (!newActiveNode.isVisible()) {
                    await this.expandToNote(this.tabContext.notePath);
                }

                newActiveNode.setActive(true, {noEvents: true});
            }
        }
    }

    async notesReloadedListener({ noteIds, activateNotePath }) {
        for (const noteId of noteIds) {
            for (const node of this.getNodesByNoteId(noteId)) {
                const branch = treeCache.getBranch(node.data.branchId, true);

                if (!branch) {
                    node.remove();
                }
                else {
                    await node.load(true);

                    await this.checkFolderStatus(node);
                }
            }
        }

        if (activateNotePath) {
            const node = await this.getNodeFromPath(activateNotePath);

            if (node && !node.isActive()) {
                await node.setActive(true);
            }
        }
    }

    noteTitleChangedListener({noteId}) {
        for (const node of this.getNodesByNoteId(noteId)) {
            treeService.setNodeTitleWithPrefix(node);
        }
    }

    async createNoteAfterListener() {
        const node = this.getActiveNode();
        const parentNoteId = node.data.parentNoteId;
        const isProtected = await treeUtils.getParentProtectedStatus(node);

        if (node.data.noteId === 'root' || node.data.noteId === await hoistedNoteService.getHoistedNoteId()) {
            return;
        }

        await treeService.createNote(node, parentNoteId, 'after', {
            isProtected: isProtected,
            saveSelection: true
        });
    }

    async createNoteIntoListener() {
        const node = this.getActiveNode();

        if (node) {
            await treeService.createNote(node, node.data.noteId, 'into', {
                isProtected: node.data.isProtected,
                saveSelection: false
            });
        }
    }

    async cutIntoNoteListener() {
        const node = this.getActiveNode();

        if (node) {
            await treeService.createNote(node, node.data.noteId, 'into', {
                isProtected: node.data.isProtected,
                saveSelection: true
            });
        }
    }

    async setExpandedToServer(branchId, isExpanded) {
        utils.assertArguments(branchId);

        const expandedNum = isExpanded ? 1 : 0;

        await server.put('branches/' + branchId + '/expanded/' + expandedNum);
    }

    async reloadNotesListener({noteIds, activateNotePath = null}) {
        if (noteIds.length === 0) {
            return;
        }

        await treeCache.reloadNotes(noteIds);

        if (!activateNotePath) {
            activateNotePath = appContext.getActiveTabNotePath();
        }

        appContext.trigger('notesReloaded', { noteIds, activateNotePath });
    }

    async reloadTreeListener() {
        const notes = await treeService.loadTreeData();

        const activeNode = this.getActiveNode();

        const activeNotePath = activeNode !== null ? await treeUtils.getNotePath(activeNode) : null;

        await this.reload(notes);

        if (activeNotePath) {
            const node = await this.getNodeFromPath(activeNotePath, true);

            await node.setActive(true, {noEvents: true});
        }
    }

    hoistedNoteChangedListener() {
        this.reloadTreeListener();
    }

    protectedSessionStartedListener() {
        this.reloadTreeListener();
    }
}