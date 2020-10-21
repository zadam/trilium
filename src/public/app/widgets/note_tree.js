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
import protectedSessionHolder from "../services/protected_session_holder.js";

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
        padding-bottom: 35px;
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
        right: 10px;
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
    
    ul.fancytree-container {
        outline: none !important;
        background-color: inherit !important;
    }
    
    .fancytree-custom-icon {
        font-size: 1.3em;
    }
    
    span.fancytree-title {
        color: inherit !important;
        background: inherit !important;
        outline: none !important;
    }
    
    span.fancytree-node.protected > span.fancytree-custom-icon {
        filter: drop-shadow(2px 2px 2px var(--main-text-color));
    }
    
    span.fancytree-node.multiple-parents .fancytree-title::after {
        content: " *"
    }
    
    span.fancytree-node.fancytree-active-clone:not(.fancytree-active) .fancytree-title {
        font-weight: bold;
    }
    
    /* first nesting level has lower left padding to avoid extra left padding. Other levels are not affected */
    .ui-fancytree > li > ul {
        padding-left: 5px;
    }
    
    span.fancytree-active .fancytree-title {
        font-weight: bold;
        border-color: var(--main-border-color) !important;
        border-radius: 5px;
    }
    
    span.fancytree-active .fancytree-title, span.fancytree-active.fancytree-selected .fancytree-title {
        color: var(--active-item-text-color) !important;
        background-color: var(--active-item-background-color) !important;
        border-color: var(--main-background-color) !important; /* invisible border */
        border-radius: 5px;
    }
    
    span.fancytree-selected .fancytree-title {
        color: var(--hover-item-text-color) !important;
        background-color: var(--hover-item-background-color) !important;
        border-color: var(--main-background-color) !important; /* invisible border */
        border-radius: 5px;
        font-style: italic;
    }
    
    span.fancytree-node:hover span.fancytree-title {
        border-color: var(--main-border-color) !important;
        border-radius: 5px;
    }
    
    span.fancytree-node.archived {
        opacity: 0.6;
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

        this.initFancyTree();

        this.setupNoteTitleTooltip();
    }

    setupNoteTitleTooltip() {
        // the following will dynamically set tree item's tooltip if the whole item's text is not currently visible
        // if the whole text is visible then no tooltip is show since that's unnecessarily distracting
        // see https://github.com/zadam/trilium/pull/1120 for discussion

        // code inspired by https://gist.github.com/jtsternberg/c272d7de5b967cec2d3d
        const isEnclosing = ($container, $sub) => {
            const conOffset           = $container.offset();
            const conDistanceFromTop  = conOffset.top + $container.outerHeight(true);
            const conDistanceFromLeft = conOffset.left + $container.outerWidth(true);

            const subOffset           = $sub.offset();
            const subDistanceFromTop  = subOffset.top + $sub.outerHeight(true);
            const subDistanceFromLeft = subOffset.left + $sub.outerWidth(true);

            return conDistanceFromTop > subDistanceFromTop
                && conOffset.top < subOffset.top
                && conDistanceFromLeft > subDistanceFromLeft
                && conOffset.left < subOffset.left;
        };

        this.$tree.on("mouseenter", "span.fancytree-title", e => {
            e.currentTarget.title = isEnclosing(this.$tree, $(e.currentTarget))
                ? ""
                : e.currentTarget.innerText;
        });
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

    initFancyTree() {
        const treeData = [this.prepareRootNode()];

        this.$tree.fancytree({
            titlesTabbable: true,
            keyboard: true,
            extensions: ["dnd5", "clones"],
            source: treeData,
            scrollOfs: {
                top: 100,
                bottom: 100
            },
            scrollParent: this.$tree,
            minExpandLevel: 2, // root can't be collapsed
            click: (event, data) => {
                this.activityDetected();

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
                        branchId: node.data.branchId,
                        title: node.title
                    }));

                    data.dataTransfer.setData("text", JSON.stringify(notes));
                    return true; // allow dragging to start
                },
                dragEnter: (node, data) => node.data.noteType !== 'search',
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
                            explodeArchives: true,
                            replaceUnderscoresWithSpaces: true
                        });
                    }
                    else {
                        const jsonStr = dataTransfer.getData("text");
                        let notes = null;

                        try {
                            notes = JSON.parse(jsonStr);
                        }
                        catch (e) {
                            logError(`Cannot parse ${jsonStr} into notes for drop`);
                            return;
                        }

                        // This function MUST be defined to enable dropping of items on the tree.
                        // data.hitMode is 'before', 'after', or 'over'.

                        const selectedBranchIds = notes.map(note => note.branchId);

                        if (data.hitMode === "before") {
                            branchService.moveBeforeBranch(selectedBranchIds, node.data.branchId);
                        } else if (data.hitMode === "after") {
                            branchService.moveAfterBranch(selectedBranchIds, node.data.branchId);
                        } else if (data.hitMode === "over") {
                            branchService.moveToParentNote(selectedBranchIds, node.data.branchId);
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

                    data.result = treeCache.reloadNotes([noteId]).then(() => {
                       const note = treeCache.getNoteFromCache(noteId);

                       return this.prepareChildren(note);
                    });
                }
                else {
                    data.result = treeCache.loadSubTree(noteId).then(note => this.prepareChildren(note));
                }
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

                    const action = await keyboardActionsService.getAction('unhoist');
                    let shortcuts = action.effectiveShortcuts.join(',');
                    shortcuts = shortcuts ? `(${shortcuts})` : '';

                    const unhoistButton = $(`<span class="unhoist-button-wrapper" title="Unhoist current note to show the whole note tree ${shortcuts}">[<a class="unhoist-button">unhoist</a>]</span>`);

                    // prepending since appending could push out (when note title is too long)
                    // the button too much to the right so that it's not visible
                    $span.prepend(unhoistButton);
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

        if (!utils.isMobile()) {
            this.getHotKeys().then(hotKeys => {
                for (const key in hotKeys) {
                    const handler = hotKeys[key];

                    $(this.tree.$container).on('keydown', null, key, evt => {
                        const node = this.tree.getActiveNode();
                        return handler(node, evt);
                        // return false from the handler will stop default handling.
                    });
                }
            });
        }

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

    prepareRootNode() {
        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

        let hoistedBranch;

        if (hoistedNoteId === 'root') {
            hoistedBranch = treeCache.getBranch('root');
        }
        else {
            const hoistedNote = treeCache.getNoteFromCache(hoistedNoteId);
            hoistedBranch = hoistedNote.getBranches()[0];
        }

        return this.prepareNode(hoistedBranch);
    }

    /**
     * @param {NoteShort} parentNote
     */
    prepareChildren(parentNote) {
        utils.assertArguments(parentNote);

        const noteList = [];

        const hideArchivedNotes = this.hideArchivedNotes;

        for (const branch of this.getChildBranches(parentNote)) {
            if (hideArchivedNotes) {
                const note = branch.getNoteFromCache();

                if (note.hasLabel('archived')) {
                    continue;
                }
            }

            const node = this.prepareNode(branch);

            noteList.push(node);
        }

        return noteList;
    }

    getIcon(note, isFolder) {
        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

        if (note.noteId !== 'root' && note.noteId === hoistedNoteId) {
            return "bx bxs-arrow-from-bottom";
        }

        return note.getIcon(isFolder);
    }

    updateNode(node) {
        const note = treeCache.getNoteFromCache(node.data.noteId);
        const branch = treeCache.getBranch(node.data.branchId);

        const isFolder = this.isFolder(note);
        const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;

        node.data.isProtected = note.isProtected;
        node.data.noteType = note.type;
        node.folder = isFolder;
        node.icon = this.getIcon(note, isFolder);
        node.extraClasses = this.getExtraClasses(note);
        node.title = utils.escapeHtml(title);

        if (node.isExpanded() !== branch.isExpanded) {
            node.setExpanded(branch.isExpanded, {noEvents: true});
        }

        node.renderTitle();
    }

    /**
     * @param {Branch} branch
     */
    prepareNode(branch, forceLazy = false) {
        const note = branch.getNoteFromCache();

        if (!note) {
            throw new Error(`Branch "${branch.branchId}" has no note "${branch.noteId}"`);
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
            expanded: (branch.isExpanded || hoistedNoteId === note.noteId) && note.type !== 'search',
            key: utils.randomString(12) // this should prevent some "duplicate key" errors
        };

        if (isFolder && node.expanded && !forceLazy) {
            node.children = this.prepareChildren(note);
        }

        return node;
    }

    isFolder(note) {
        return note.type === 'search'
            || this.getChildBranches(note).length > 0;
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

        // we're not checking hideArchivedNotes since that would mean we need to lazy load the child notes
        // which would seriously slow down everything.
        // we check this flag only once user chooses to expand the parent. This has the negative consequence that
        // note may appear as folder but not contain any children when all of them are archived

        return childBranches;
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
        const nodes = this.getSelectedNodes(true);

        // the node you start dragging should be included even if not selected
        if (node && !nodes.find(n => n.key === node.key)) {
            nodes.push(node);
        }

        if (nodes.length === 0) {
            nodes.push(this.getActiveNode());
        }

        return nodes;
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
            this.tree.setFocus(true);

            const node = await this.expandToNote(activeContext.notePath);

            await node.makeVisible({scrollIntoView: true});
            node.setFocus(true);
        }
    }

    /** @return {FancytreeNode} */
    async getNodeFromPath(notePath, expand = false, logErrors = true) {
        utils.assertArguments(notePath);

        const hoistedNoteId = hoistedNoteService.getHoistedNoteId();
        /** @const {FancytreeNode} */
        let parentNode = null;

        const resolvedNotePathSegments = await treeService.resolveNotePathToSegments(notePath, logErrors);

        if (!resolvedNotePathSegments) {
            if (logErrors) {
                logError("Could not find run path for notePath:", notePath);
            }

            return;
        }

        for (const childNoteId of resolvedNotePathSegments) {
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
                    await parentNode.setExpanded(true);

                    // although previous line should set the expanded status, it seems to happen asynchronously
                    // so we need to make sure it is set properly before calling updateNode which uses this flag
                    const branch = treeCache.getBranch(parentNode.data.branchId);
                    branch.isExpanded = true;
                }

                this.updateNode(parentNode);

                let foundChildNode = this.findChildNode(parentNode, childNoteId);

                if (!foundChildNode) { // note might be recently created so we'll force reload and try again
                    await parentNode.load(true);

                    foundChildNode = this.findChildNode(parentNode, childNoteId);

                    if (!foundChildNode) {
                        if (logErrors) {
                            // besides real errors this can be also caused by hiding of e.g. included images
                            // these are real notes with real notePath, user can display them in a detail
                            // but they don't have a node in the tree

                            ws.logError(`Can't find node for child node of noteId=${childNoteId} for parent of noteId=${parentNode.data.noteId} and hoistedNoteId=${hoistedNoteId}, requested path is ${notePath}`);
                        }

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
        return parentNode.getChildren().find(childNode => childNode.data.noteId === childNoteId);
    }

    /** @return {FancytreeNode} */
    async expandToNote(notePath, logErrors = true) {
        return this.getNodeFromPath(notePath, true, logErrors);
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
        this.$treeSettingsPopup.hide();

        this.activityDetected();

        const oldActiveNode = this.getActiveNode();
        let oldActiveNodeFocused = false;

        if (oldActiveNode) {
            oldActiveNodeFocused = oldActiveNode.hasFocus();

            oldActiveNode.setActive(false);
            oldActiveNode.setFocus(false);
        }

        if (this.tabContext && this.tabContext.notePath && !this.tabContext.note.isDeleted) {
            const newActiveNode = await this.getNodeFromPath(this.tabContext.notePath);

            if (newActiveNode) {
                if (!newActiveNode.isVisible()) {
                    await this.expandToNote(this.tabContext.notePath);
                }

                newActiveNode.setActive(true, {noEvents: true, noFocus: !oldActiveNodeFocused});
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

    activityDetected() {
        if (this.autoCollapseTimeoutId) {
            clearTimeout(this.autoCollapseTimeoutId);
        }

        this.autoCollapseTimeoutId = setTimeout(() => {
            /*
             * We're collapsing notes after period of inactivity to "cleanup" the tree - users rarely
             * collapse the notes and the tree becomes unusuably large.
             * Some context: https://github.com/zadam/trilium/issues/1192
             */

            const noteIdsToKeepExpanded = new Set(
                appContext.tabManager.getTabContexts()
                    .map(tc => tc.notePathArray)
                    .flat()
            );

            let noneCollapsedYet = true;

            this.tree.getRootNode().visit(node => {
                if (node.isExpanded() && !noteIdsToKeepExpanded.has(node.data.noteId)) {
                    node.setExpanded(false);

                    if (noneCollapsedYet) {
                        toastService.showMessage("Auto collapsing notes after inactivity...");
                        noneCollapsedYet = false;
                    }
                }
            }, false);
        }, 600 * 1000);
    }

    async entitiesReloadedEvent({loadResults}) {
        this.activityDetected();

        if (loadResults.isEmptyForTree()) {
            return;
        }

        const activeNode = this.getActiveNode();
        const activeNodeFocused = activeNode && activeNode.hasFocus();
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
                        // make sure it's loaded
                        await treeCache.getNote(branch.noteId);

                        // we're forcing lazy since it's not clear if the whole required subtree is in tree cache
                        parentNode.addChildren([this.prepareNode(branch, true)]);

                        this.sortChildren(parentNode);

                        // this might be a first child which would force an icon change
                        noteIdsToUpdate.add(branch.parentNoteId);
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
                        this.sortChildren(node);
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
            let node = await this.expandToNote(activeNotePath, false);

            if (node && node.data.noteId !== activeNoteId) {
                // if the active note has been moved elsewhere then it won't be found by the path
                // so we switch to the alternative of trying to find it by noteId
                const notesById = this.getNodesByNoteId(activeNoteId);

                // if there are multiple clones then we'd rather not activate any one
                node = notesById.length === 1 ? notesById[0] : null;
            }

            if (node) {
                node.setActive(true, {noEvents: true, noFocus: true});
            }
            else {
                // this is used when original note has been deleted and we want to move the focus to the note above/below
                node = await this.expandToNote(nextNotePath, false);

                if (node) {
                    await appContext.tabManager.getActiveTabContext().setNote(nextNotePath);
                }
            }

            const newActiveNode = this.getActiveNode();

            // return focus if the previously active node was also focused
            if (newActiveNode && activeNodeFocused) {
                await newActiveNode.setFocus(true);
            }
        }
    }

    sortChildren(node) {
        node.sortChildren((nodeA, nodeB) => {
            const branchA = treeCache.branches[nodeA.data.branchId];
            const branchB = treeCache.branches[nodeB.data.branchId];

            if (!branchA || !branchB) {
                return 0;
            }

            return branchA.notePosition - branchB.notePosition;
        });
    }

    async setExpanded(branchId, isExpanded) {
        utils.assertArguments(branchId);

        const branch = treeCache.getBranch(branchId, true);

        if (!branch) {
            if (branchId && branchId.startsWith('virt')) {
                // in case of virtual branches there's nothing to update
                return;
            }
            else {
                logError(`Cannot find branch=${branchId}`);
                return;
            }
        }

        branch.isExpanded = isExpanded;

        await server.put(`branches/${branchId}/expanded/${isExpanded ? 1 : 0}`);
    }

    async reloadTreeFromCache() {
        const activeNode = this.getActiveNode();

        const activeNotePath = activeNode !== null ? treeService.getNotePath(activeNode) : null;

        const rootNode = this.prepareRootNode();

        await this.batchUpdate(async () => {
            await this.tree.reload([rootNode]);
        });

        if (activeNotePath) {
            const node = await this.getNodeFromPath(activeNotePath, true);

            await node.setActive(true, {noEvents: true, noFocus: true});
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
        const hotKeyMap = {};

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
            branchService.moveToParentNote([node.data.branchId], toNode.data.branchId);
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
        clipboard.pasteInto(node.data.branchId);
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

    protectSubtreeCommand({node}) {
        protectedSessionService.protectNote(node.data.noteId, true, true);
    }

    unprotectSubtreeCommand({node}) {
        protectedSessionService.protectNote(node.data.noteId, false, true);
    }

    duplicateNoteCommand({node}) {
        const nodesToDuplicate = this.getSelectedOrActiveNodes(node);

        for (const nodeToDuplicate of nodesToDuplicate) {
            const note = treeCache.getNoteFromCache(nodeToDuplicate.data.noteId);

            if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
                continue;
            }

            const branch = treeCache.getBranch(nodeToDuplicate.data.branchId);

            noteCreateService.duplicateNote(nodeToDuplicate.data.noteId, branch.parentNoteId);
        }
    }
}
