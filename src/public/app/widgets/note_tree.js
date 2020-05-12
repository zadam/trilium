import hoistedNoteService from "../services/hoisted_note.js";
import treeService from "../services/tree.js";
import utils from "../services/utils.js";
import contextMenu from "../services/context_menu.js";
import treeCache from "../services/tree_cache.js";
import branchService from "../services/branches.js";
import ws from "../services/ws.js";
import TabAwareWidget from "./tab_aware_widget.js";
import server from "../services/server.js";
import noteCreateService from "../services/note_create.js";
import toastService from "../services/toast.js";
import appContext from "../services/app_context.js";
import keyboardActionsService from "../services/keyboard_actions.js";
import clipboard from "../services/clipboard.js";
import protectedSessionService from "../services/protected_session.js";
import syncService from "../services/sync.js";
import options from "../services/options.js";

const TPL = `
<div class="tree-wrapper">
    <style>
    .tree-wrapper {
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: 60%;
        font-family: var(--tree-font-family);
        font-size: var(--tree-font-size);
        position: relative;
        min-height: 0;
    }
    
    .tree {
        height: 100%;
        overflow: auto;
    }
    
    .refresh-search-button {
        cursor: pointer;
        position: relative;
        top: -1px;
        border: 1px solid transparent;
        padding: 2px;
        border-radius: 2px;
    }
    
    .refresh-search-button:hover {
        border-color: var(--button-border-color);
    }
    
    .tree-settings-button {
        position: absolute;
        top: 10px;
        right: 20px;
        z-index: 100;
    }
    
    .tree-settings-popup {
        display: none; 
        position: absolute; 
        background-color: var(--accented-background-color); 
        border: 1px solid var(--main-border-color); 
        padding: 20px; 
        z-index: 1000;
        width: 320px; 
        border-radius: 10px 0 10px 10px;
    }
    </style>
    
    <button class="btn btn-sm icon-button bx bx-cog tree-settings-button" title="Tree settings"></button>
    
    <div class="tree-settings-popup">
        <div class="form-check">
            <label class="form-check-label">
                <input class="form-check-input hide-archived-notes" type="checkbox" value="">
            
                Hide archived notes
            </label>
        </div>
        <div class="form-check">
            <label class="form-check-label">
                <input class="form-check-input hide-included-images" type="checkbox" value="">
                
                Hide images included in a note
                <span class="bx bx-info-circle" 
                      title="Images which are shown in the parent text note will not be displayed in the tree"></span>
            </label>
        </div>
    
        <br/>
    
        <button class="btn btn-sm btn-primary save-tree-settings-button" type="submit">Save & apply changes</button>
    </div>
    
    <div class="tree"></div>
</div>
`;

const NOTE_TYPE_ICONS = {
    "file": "bx bx-file",
    "image": "bx bx-image",
    "code": "bx bx-code",
    "render": "bx bx-extension",
    "search": "bx bx-file-find",
    "relation-map": "bx bx-map-alt",
    "book": "bx bx-book"
};

export default class NoteTreeWidget extends TabAwareWidget {
    constructor(treeName) {
        super();

        this.treeName = treeName;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$tree = this.$widget.find('.tree');

        this.$tree.on("click", ".unhoist-button", hoistedNoteService.unhoist);
        this.$tree.on("click", ".refresh-search-button", () => this.refreshSearch());

        // fancytree doesn't support middle click so this is a way to support it
        this.$tree.on('mousedown', '.fancytree-title', e => {
            if (e.which === 2) {
                const node = $.ui.fancytree.getNode(e);

                const notePath = treeService.getNotePath(node);

                if (notePath) {
                    appContext.tabManager.openTabWithNote(notePath);
                }

                e.stopPropagation();
                e.preventDefault();
            }
        });

        this.$treeSettingsPopup = this.$widget.find('.tree-settings-popup');
        this.$hideArchivedNotesCheckbox = this.$treeSettingsPopup.find('.hide-archived-notes');
        this.$hideIncludedImages = this.$treeSettingsPopup.find('.hide-included-images');

        this.$treeSettingsButton = this.$widget.find('.tree-settings-button');
        this.$treeSettingsButton.on("click", e => {
            if (this.$treeSettingsPopup.is(":visible")) {
                this.$treeSettingsPopup.hide();
                return;
            }

            this.$hideArchivedNotesCheckbox.prop("checked", this.hideArchivedNotes);
            this.$hideIncludedImages.prop("checked", this.hideIncludedImages);

            let top = this.$treeSettingsButton[0].offsetTop;
            let left = this.$treeSettingsButton[0].offsetLeft;
            top += this.$treeSettingsButton.outerHeight();
            left += this.$treeSettingsButton.outerWidth() - this.$treeSettingsPopup.outerWidth();

            if (left < 0) {
                left = 0;
            }

            this.$treeSettingsPopup.css({
                display: "block",
                top: top,
                left: left
            }).addClass("show");

            return false;
        });

        this.$treeSettingsPopup.on("click", e => { e.stopPropagation(); });

        $(document).on('click', () => this.$treeSettingsPopup.hide());

        this.$saveTreeSettingsButton = this.$treeSettingsPopup.find('.save-tree-settings-button');
        this.$saveTreeSettingsButton.on('click', async () => {
            await this.setHideArchivedNotes(this.$hideArchivedNotesCheckbox.prop("checked"));
            await this.setHideIncludedImages(this.$hideIncludedImages.prop("checked"));

            this.$treeSettingsPopup.hide();

            this.reloadTreeFromCache();
        });

        this.initialized = this.initFancyTree();

        return this.$widget;
    }

    get hideArchivedNotes() {
        return options.is("hideArchivedNotes_" + this.treeName);
    }

    async setHideArchivedNotes(val) {
        await options.save("hideArchivedNotes_" + this.treeName, val.toString());
    }

    get hideIncludedImages() {
        return options.is("hideIncludedImages_" + this.treeName);
    }

    async setHideIncludedImages(val) {
        await options.save("hideIncludedImages_" + this.treeName, val.toString());
    }

    async initFancyTree() {
        const treeData = [await this.prepareRootNode()];

        this.$tree.fancytree({
            autoScroll: true,
            keyboard: false, // we takover keyboard handling in the hotkeys plugin
            extensions: utils.isMobile() ? ["dnd5", "clones"] : ["hotkeys", "dnd5", "clones"],
            source: treeData,
            scrollParent: this.$tree,
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
                        const notePath = treeService.getNotePath(node);
                        appContext.tabManager.openTabWithNote(notePath);
                    }
                    else if (data.node.isActive()) {
                        // this is important for single column mobile view, otherwise it's not possible to see again previously displayed note
                        this.tree.reactivate(true);
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
                contextMenu.hide();

                const notePath = treeService.getNotePath(data.node);

                const activeTabContext = appContext.tabManager.getActiveTabContext();
                await activeTabContext.setNote(notePath);

                if (utils.isMobile()) {
                    this.triggerCommand('setActiveScreen', {screen:'detail'});
                }
            },
            expand: (event, data) => this.setExpanded(data.node.data.branchId, true),
            collapse: (event, data) => this.setExpanded(data.node.data.branchId, false),
            hotkeys: utils.isMobile() ? undefined : { keydown: await this.getHotKeys() },
            dnd5: {
                autoExpandMS: 600,
                dragStart: (node, data) => {
                    // don't allow dragging root node
                    if (node.data.noteId === hoistedNoteService.getHoistedNoteId()
                        || node.getParent().data.noteType === 'search') {
                        return false;
                    }

                    const notes = this.getSelectedOrActiveNodes(node).map(node => ({
                        noteId: node.data.noteId,
                        title: node.title
                    }));

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
                            && (node.data.noteId === hoistedNoteService.getHoistedNoteId() || node.getParent().data.noteType === 'search'))) {

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

                        const selectedBranchIds = this.getSelectedOrActiveNodes().map(node => node.data.branchId);

                        if (data.hitMode === "before") {
                            branchService.moveBeforeBranch(selectedBranchIds, node.data.branchId);
                        } else if (data.hitMode === "after") {
                            branchService.moveAfterBranch(selectedBranchIds, node.data.branchId);
                        } else if (data.hitMode === "over") {
                            branchService.moveToParentNote(selectedBranchIds, node.data.noteId);
                        } else {
                            throw new Error("Unknown hitMode=" + data.hitMode);
                        }
                    }
                }
            },
            lazyLoad: (event, data) => {
                const {noteId, noteType} = data.node.data;

                if (noteType === 'search') {
                    const notePath = treeService.getNotePath(data.node.getParent());

                    // this is a search cycle (search note is a descendant of its own search result)
                    if (notePath.includes(noteId)) {
                        data.result = [];
                        return;
                    }
                }

                data.result = treeCache.getNote(noteId).then(note => this.prepareChildren(note));
            },
            clones: {
                highlightActiveClones: true
            },
            enhanceTitle: async function (event, data) {
                const node = data.node;
                const $span = $(node.span);

                if (node.data.noteId !== 'root'
                    && node.data.noteId === hoistedNoteService.getHoistedNoteId()
                    && $span.find('.unhoist-button').length === 0) {

                    const unhoistButton = $('<span>&nbsp; (<a class="unhoist-button">unhoist</a>)</span>');

                    $span.append(unhoistButton);
                }

                const note = await treeCache.getNote(node.data.noteId);

                if (note.type === 'search' && $span.find('.refresh-search-button').length === 0) {
                    const refreshSearchButton = $('<span>&nbsp; <span class="refresh-search-button bx bx-refresh" title="Refresh saved search results"></span></span>');

                    $span.append(refreshSearchButton);
                }
            },
            // this is done to automatically lazy load all expanded notes after tree load
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

        this.$tree.on('contextmenu', '.fancytree-node', e => {
            const node = $.ui.fancytree.getNode(e);

            import("../services/tree_context_menu.js").then(({default: TreeContextMenu}) => {
                const treeContextMenu = new TreeContextMenu(this, node);
                treeContextMenu.show(e);
            });

            return false; // blocks default browser right click menu
        });

        this.tree = $.ui.fancytree.getTree(this.$tree);
    }

    async prepareRootNode() {
        await treeCache.initializedPromise;

        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

        let hoistedBranch;

        if (hoistedNoteId === 'root') {
            hoistedBranch = treeCache.getBranch('root');
        }
        else {
            const hoistedNote = await treeCache.getNote(hoistedNoteId);
            hoistedBranch = (await hoistedNote.getBranches())[0];
        }

        return await this.prepareNode(hoistedBranch);
    }

    async prepareChildren(note) {
        if (note.type === 'search') {
            return await this.prepareSearchNoteChildren(note);
        }
        else {
            return await this.prepareNormalNoteChildren(note);
        }
    }

    getIconClass(note) {
        const labels = note.getLabels('iconClass');

        return labels.map(l => l.value).join(' ');
    }

    getIcon(note, isFolder) {
        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

        const iconClass = this.getIconClass(note);

        if (iconClass) {
            return iconClass;
        }
        else if (note.noteId === 'root') {
            return "bx bx-chevrons-right";
        }
        else if (note.noteId === hoistedNoteId) {
            return "bx bxs-arrow-from-bottom";
        }
        else if (note.type === 'text') {
            if (isFolder) {
                return "bx bx-folder";
            }
            else {
                return "bx bx-note";
            }
        }
        else {
            return NOTE_TYPE_ICONS[note.type];
        }
    }

    async prepareNode(branch) {
        const note = await branch.getNote();

        if (!note) {
            throw new Error(`Branch has no note ` + branch.noteId);
        }

        const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;
        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

        const isFolder = this.isFolder(note);

        const node = {
            noteId: note.noteId,
            parentNoteId: branch.parentNoteId,
            branchId: branch.branchId,
            isProtected: note.isProtected,
            noteType: note.type,
            title: utils.escapeHtml(title),
            extraClasses: this.getExtraClasses(note),
            icon: this.getIcon(note, isFolder),
            refKey: note.noteId,
            lazy: true,
            folder: isFolder,
            expanded: branch.isExpanded || hoistedNoteId === note.noteId,
            key: utils.randomString(12) // this should prevent some "duplicate key" errors
        };

        if (node.folder && node.expanded) {
            node.children = await this.prepareChildren(note);
        }

        return node;
    }

    isFolder(note) {
        if (note.type === 'search') {
            return true;
        }
        else {
            const childBranches = this.getChildBranches(note);

            return childBranches.length > 0;
        }
    }

    async prepareNormalNoteChildren(parentNote) {
        utils.assertArguments(parentNote);

        const noteList = [];

        for (const branch of this.getChildBranches(parentNote)) {
            const node = await this.prepareNode(branch);

            noteList.push(node);
        }

        return noteList;
    }

    getChildBranches(parentNote) {
        let childBranches = parentNote.getChildBranches();

        if (!childBranches) {
            ws.logError(`No children for ${parentNote}. This shouldn't happen.`);
            return;
        }

        if (this.hideIncludedImages) {
            const imageLinks = parentNote.getRelations('imageLink');

            // image is already visible in the parent note so no need to display it separately in the book
            childBranches = childBranches.filter(branch => !imageLinks.find(rel => rel.value === branch.noteId));
        }

        return childBranches;
    }

    async prepareSearchNoteChildren(note) {
        await treeCache.reloadNotes([note.noteId]);

        const newNote = await treeCache.getNote(note.noteId);

        return await this.prepareNormalNoteChildren(newNote);
    }

    getExtraClasses(note) {
        utils.assertArguments(note);

        const extraClasses = [];

        if (note.isProtected) {
            extraClasses.push("protected");
        }

        if (note.getParentNoteIds().length > 1) {
            extraClasses.push("multiple-parents");
        }

        const cssClass = note.getCssClass();

        if (cssClass) {
            extraClasses.push(cssClass);
        }

        extraClasses.push(utils.getNoteTypeClass(note.type));

        if (note.mime) { // some notes should not have mime type (e.g. render)
            extraClasses.push(utils.getMimeTypeClass(note.mime));
        }

        if (note.hasLabel('archived')) {
            extraClasses.push("archived");
        }

        return extraClasses.join(" ");
    }

    /** @return {FancytreeNode[]} */
    getSelectedNodes(stopOnParents = false) {
        return this.tree.getSelectedNodes(stopOnParents);
    }

    /** @return {FancytreeNode[]} */
    getSelectedOrActiveNodes(node = null) {
        const notes = this.getSelectedNodes(true);

        if (notes.length === 0) {
            notes.push(node ? node : this.getActiveNode());
        }

        return notes;
    }

    async setExpandedStatusForSubtree(node, isExpanded) {
        if (!node) {
            const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

            node = this.getNodesByNoteId(hoistedNoteId)[0];
        }

        const {branchIds} = await server.put(`branches/${node.data.branchId}/expanded-subtree/${isExpanded ? 1 : 0}`);

        treeCache.getBranches(branchIds, true).forEach(branch => branch.isExpanded = isExpanded);

        await this.batchUpdate(async () => {
            await node.load(true);

            if (node.data.noteId !== 'root') { // root is always expanded
                await node.setExpanded(isExpanded, {noEvents: true});
            }
        });
    }

    async expandTree(node = null) {
        await this.setExpandedStatusForSubtree(node, true);
    }

    async collapseTree(node = null) {
        await this.setExpandedStatusForSubtree(node, false);
    }

    /**
     * @return {FancytreeNode|null}
     */
    getActiveNode() {
        return this.tree.getActiveNode();
    }

    /**
     * focused & not active node can happen during multiselection where the node is selected
     * but not activated (its content is not displayed in the detail)
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

    async scrollToActiveNoteEvent() {
        const activeContext = appContext.tabManager.getActiveTabContext();

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

        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();
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

                this.updateNode(parentNode);

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

    updateNode(node) {
        const note = treeCache.getNoteFromCache(node.data.noteId);
        const branch = treeCache.getBranch(node.data.branchId);

        const isFolder = this.isFolder(note);

        node.data.isProtected = note.isProtected;
        node.data.noteType = note.type;
        node.folder = isFolder;
        node.icon = this.getIcon(note, isFolder);
        node.extraClasses = this.getExtraClasses(note);
        node.title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;
        node.renderTitle();
    }

    /** @return {FancytreeNode[]} */
    getNodesByBranchId(branchId) {
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

    // must be event since it's triggered from outside the tree
    collapseTreeEvent() { this.collapseTree(); }

    isEnabled() {
        return !!this.tabContext;
    }

    async refresh() {
        this.toggleInt(this.isEnabled());

        const oldActiveNode = this.getActiveNode();

        if (oldActiveNode) {
            oldActiveNode.setActive(false);
            oldActiveNode.setFocus(false);
        }

        if (this.tabContext && this.tabContext.notePath && !this.tabContext.note.isDeleted) {
            const newActiveNode = await this.getNodeFromPath(this.tabContext.notePath);

            if (newActiveNode) {
                if (!newActiveNode.isVisible()) {
                    await this.expandToNote(this.tabContext.notePath);
                }

                newActiveNode.setActive(true, {noEvents: true});

                newActiveNode.makeVisible({scrollIntoView: true});
            }
        }
    }

    async refreshSearch() {
        const activeNode = this.getActiveNode();

        activeNode.load(true);
        activeNode.setExpanded(true);

        toastService.showMessage("Saved search note refreshed.");
    }

    async batchUpdate(cb) {
        try {
            // disable rendering during update for increased performance
            this.tree.enableUpdate(false);

            await cb();
        }
        finally {
            this.tree.enableUpdate(true);
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        const activeNode = this.getActiveNode();
        const nextNode = activeNode ? (activeNode.getNextSibling() || activeNode.getPrevSibling() || activeNode.getParent()) : null;
        const activeNotePath = activeNode ? treeService.getNotePath(activeNode) : null;
        const nextNotePath = nextNode ? treeService.getNotePath(nextNode) : null;
        const activeNoteId = activeNode ? activeNode.data.noteId : null;

        const noteIdsToUpdate = new Set();
        const noteIdsToReload = new Set();

        for (const attr of loadResults.getAttributes()) {
            if (attr.type === 'label' && ['iconClass', 'cssClass'].includes(attr.name)) {
                if (attr.isInheritable) {
                    noteIdsToReload.add(attr.noteId);
                }
                else {
                    noteIdsToUpdate.add(attr.noteId);
                }
            }
            else if (attr.type === 'relation' && attr.name === 'template') {
                // missing handling of things inherited from template
                noteIdsToReload.add(attr.noteId);
            }
            else if (attr.type === 'relation' && attr.name === 'imageLink') {
                const note = treeCache.getNoteFromCache(attr.noteId);

                if (note && note.getChildNoteIds().includes(attr.value)) {
                    // there's new/deleted imageLink betwen note and its image child - which can show/hide
                    // the image (if there is a imageLink relation between parent and child then it is assumed to be "contained" in the note and thus does not have to be displayed in the tree)
                    noteIdsToReload.add(attr.noteId);
                }
            }
        }

        for (const branch of loadResults.getBranches()) {
            for (const node of this.getNodesByBranchId(branch.branchId)) {
                if (branch.isDeleted) {
                    if (node.isActive()) {
                        const newActiveNode = node.getNextSibling()
                            || node.getPrevSibling()
                            || node.getParent();

                        if (newActiveNode) {
                            newActiveNode.setActive(true, {noEvents: true, noFocus: true});
                        }
                    }

                    if (node.getParent()) {
                        node.remove();
                    }

                    noteIdsToUpdate.add(branch.parentNoteId);
                }
                else {
                    noteIdsToUpdate.add(branch.noteId);
                }
            }

            if (!branch.isDeleted) {
                for (const parentNode of this.getNodesByNoteId(branch.parentNoteId)) {
                    if (parentNode.isFolder() && !parentNode.isLoaded()) {
                        continue;
                    }

                    const found = (parentNode.getChildren() || []).find(child => child.data.noteId === branch.noteId);

                    if (!found) {
                        noteIdsToReload.add(branch.parentNoteId);
                    }
                }
            }
        }

        for (const noteId of loadResults.getNoteIds()) {
            noteIdsToUpdate.add(noteId);
        }

        await this.batchUpdate(async () => {
            for (const noteId of noteIdsToReload) {
                for (const node of this.getNodesByNoteId(noteId)) {
                    await node.load(true);

                    noteIdsToUpdate.add(noteId);
                }
            }

            for (const parentNoteId of loadResults.getNoteReorderings()) {
                for (const node of this.getNodesByNoteId(parentNoteId)) {
                    if (node.isLoaded()) {
                        node.sortChildren((nodeA, nodeB) => {
                            const branchA = treeCache.branches[nodeA.data.branchId];
                            const branchB = treeCache.branches[nodeB.data.branchId];

                            if (!branchA || !branchB) {
                                return 0;
                            }

                            return branchA.notePosition - branchB.notePosition;
                        });
                    }
                }
            }
        });

        // for some reason node update cannot be in the batchUpdate() block (node is not re-rendered)
        for (const noteId of noteIdsToUpdate) {
            for (const node of this.getNodesByNoteId(noteId)) {
                this.updateNode(node);
            }
        }

        if (activeNotePath) {
            let node = await this.expandToNote(activeNotePath);

            if (node && node.data.noteId !== activeNoteId) {
                // if the active note has been moved elsewhere then it won't be found by the path
                // so we switch to the alternative of trying to find it by noteId
                const notesById = this.getNodesByNoteId(activeNoteId);

                // if there are multiple clones then we'd rather not activate any one
                node = notesById.length === 1 ? notesById[0] : null;
            }

            if (node) {
                node.setActive(true, {noEvents: true});
            }
            else {
                // this is used when original note has been deleted and we want to move the focus to the note above/below
                node = await this.expandToNote(nextNotePath);

                if (node) {
                    this.tree.setFocus();
                    node.setFocus(true);

                    await appContext.tabManager.getActiveTabContext().setNote(nextNotePath);
                }
            }
        }
    }

    async setExpanded(branchId, isExpanded) {
        utils.assertArguments(branchId);

        const branch = treeCache.getBranch(branchId);
        branch.isExpanded = isExpanded;

        await server.put(`branches/${branchId}/expanded/${isExpanded ? 1 : 0}`);
    }

    async reloadTreeFromCache() {
        const activeNode = this.getActiveNode();

        const activeNotePath = activeNode !== null ? treeService.getNotePath(activeNode) : null;

        const rootNode = await this.prepareRootNode();

        await this.batchUpdate(async () => {
            await this.tree.reload([rootNode]);
        });

        if (activeNotePath) {
            const node = await this.getNodeFromPath(activeNotePath, true);

            await node.setActive(true, {noEvents: true});
        }
    }

    hoistedNoteChangedEvent() {
        this.reloadTreeFromCache();
    }

    treeCacheReloadedEvent() {
        this.reloadTreeFromCache();
    }

    async getHotKeys() {
        const actions = await keyboardActionsService.getActionsForScope('note-tree');
        const hotKeyMap = {
            // code below shouldn't be necessary normally, however there's some problem with interaction with context menu plugin
            // after opening context menu, standard shortcuts don't work, but they are detected here
            // so we essentially takeover the standard handling with our implementation.
            "left": node => {
                node.navigate($.ui.keyCode.LEFT, true);
                this.clearSelectedNodes();

                return false;
            },
            "right": node => {
                node.navigate($.ui.keyCode.RIGHT, true);
                this.clearSelectedNodes();

                return false;
            },
            "up": node => {
                node.navigate($.ui.keyCode.UP, true);
                this.clearSelectedNodes();

                return false;
            },
            "down": node => {
                node.navigate($.ui.keyCode.DOWN, true);
                this.clearSelectedNodes();

                return false;
            }
        };

        for (const action of actions) {
            for (const shortcut of action.effectiveShortcuts) {
                hotKeyMap[utils.normalizeShortcut(shortcut)] = node => {
                    this.triggerCommand(action.actionName, {node});

                    return false;
                }
            }
        }

        return hotKeyMap;
    }

    /**
     * @param {FancytreeNode} node
     */
    getSelectedOrActiveBranchIds(node) {
        const nodes = this.getSelectedOrActiveNodes(node);

        return nodes.map(node => node.data.branchId);
    }

    async deleteNotesCommand({node}) {
        const branchIds = this.getSelectedOrActiveBranchIds(node);

        await branchService.deleteNotes(branchIds);

        this.clearSelectedNodes();
    }

    moveNoteUpCommand({node}) {
        const beforeNode = node.getPrevSibling();

        if (beforeNode !== null) {
            branchService.moveBeforeBranch([node.data.branchId], beforeNode.data.branchId);
        }
    }

    moveNoteDownCommand({node}) {
        const afterNode = node.getNextSibling();
        if (afterNode !== null) {
            branchService.moveAfterBranch([node.data.branchId], afterNode.data.branchId);
        }
    }

    moveNoteUpInHierarchyCommand({node}) {
        branchService.moveNodeUpInHierarchy(node);
    }

    moveNoteDownInHierarchyCommand({node}) {
        const toNode = node.getPrevSibling();

        if (toNode !== null) {
            branchService.moveToParentNote([node.data.branchId], toNode.data.noteId);
        }
    }

    addNoteAboveToSelectionCommand() {
        const node = this.getFocusedNode();

        if (!node) {
            return;
        }

        if (node.isActive()) {
            node.setSelected(true);
        }

        const prevSibling = node.getPrevSibling();

        if (prevSibling) {
            prevSibling.setActive(true, {noEvents: true});

            if (prevSibling.isSelected()) {
                node.setSelected(false);
            }

            prevSibling.setSelected(true);
        }
    }

    addNoteBelowToSelectionCommand() {
        const node = this.getFocusedNode();

        if (!node) {
            return;
        }

        if (node.isActive()) {
            node.setSelected(true);
        }

        const nextSibling = node.getNextSibling();

        if (nextSibling) {
            nextSibling.setActive(true, {noEvents: true});

            if (nextSibling.isSelected()) {
                node.setSelected(false);
            }

            nextSibling.setSelected(true);
        }
    }

    expandSubtreeCommand({node}) {
        this.expandTree(node);
    }

    collapseSubtreeCommand({node}) {
        this.collapseTree(node);
    }

    sortChildNotesCommand({node}) {
        treeService.sortAlphabetically(node.data.noteId);
    }

    async recentChangesInSubtreeCommand({node}) {
        const recentChangesDialog = await import('../dialogs/recent_changes.js');

        recentChangesDialog.showDialog(node.data.noteId);
    }

    selectAllNotesInParentCommand({node}) {
        for (const child of node.getParent().getChildren()) {
            child.setSelected(true);
        }
    }

    copyNotesToClipboardCommand({node}) {
        clipboard.copy(this.getSelectedOrActiveBranchIds(node));
    }

    cutNotesToClipboardCommand({node}) {
        clipboard.cut(this.getSelectedOrActiveBranchIds(node));
    }

    pasteNotesFromClipboardCommand({node}) {
        clipboard.pasteInto(node.data.noteId);
    }

    pasteNotesAfterFromClipboard({node}) {
        clipboard.pasteAfter(node.data.branchId);
    }

    async exportNoteCommand({node}) {
        const exportDialog = await import('../dialogs/export.js');
        const notePath = treeService.getNotePath(node);

        exportDialog.showDialog(notePath,"subtree");
    }

    async importIntoNoteCommand({node}) {
        const importDialog = await import('../dialogs/import.js');
        importDialog.showDialog(node.data.noteId);
    }

    forceNoteSyncCommand({node}) {
        syncService.forceNoteSync(node.data.noteId);
    }

    editNoteTitleCommand({node}) {
        appContext.triggerCommand('focusOnTitle');
    }

    activateParentNoteCommand({node}) {
        if (!hoistedNoteService.isRootNode(node)) {
            node.getParent().setActive().then(this.clearSelectedNodes);
        }
    }

    protectSubtreeCommand({node}) {
        protectedSessionService.protectNote(node.data.noteId, true, true);
    }

    unprotectSubtreeCommand({node}) {
        protectedSessionService.protectNote(node.data.noteId, false, true);
    }

    duplicateNoteCommand({node}) {
        const branch = treeCache.getBranch(node.data.branchId);

        noteCreateService.duplicateNote(node.data.noteId, branch.parentNoteId);
    }
}
