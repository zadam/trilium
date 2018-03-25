"use strict";

class TreeCache {
    constructor(noteRows, branchRows) {
        this.parents = [];
        this.children = [];
        this.childParentToBranch = {};

        this.notes = {};
        for (const noteRow of noteRows) {
            const note = new NoteShort(this, noteRow);

            this.notes[note.noteId] = note;
        }

        this.branches = {};
        for (const branchRow of branchRows) {
            const branch = new Branch(this, branchRow);

            this.branches[branch.branchId] = branch;
            this.addBranch(branch);
        }
    }

    getNote(noteId) {
        return this.notes[noteId];
    }

    addBranch(branch) {
        this.parents[branch.noteId] = this.parents[branch.noteId] || [];
        this.parents[branch.noteId].push(this.notes[branch.parentNoteId]);

        this.children[branch.parentNoteId] = this.children[branch.parentNoteId] || [];
        this.children[branch.parentNoteId].push(this.notes[branch.noteId]);

        this.childParentToBranch[branch.noteId + '-' + branch.parentNoteId] = branch;
    }

    add(note, branch) {
        this.notes[note.noteId] = note;

        this.addBranch(branch);
    }

    async getBranch(childNoteId, parentNoteId) {
        return this.childParentToBranch[childNoteId + '-' + parentNoteId];
    }
}

class NoteShort {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        this.noteId = row.noteId;
        this.title = row.title;
        this.isProtected = row.isProtected;
        this.type = row.type;
        this.mime = row.mime;
        this.hideInAutocomplete = row.hideInAutocomplete;
    }

    async getBranches() {
        const branches = [];

        for (const parent of this.treeCache.parents[this.noteId]) {
            branches.push(await this.treeCache.getBranch(this.noteId, p.noteId));
        }

        return branches;
    }

    async getChildBranches() {
        const branches = [];

        for (const child of this.treeCache.children[this.noteId]) {
            branches.push(await this.treeCache.getBranch(child.noteId, this.noteId));
        }

        return branches;
    }

    async getParentNotes() {
        return this.treeCache.parents[this.noteId] || [];
    }

    async getChildNotes() {
        return this.treeCache.children[this.noteId] || [];
    }

    get toString() {
        return `Note(noteId=${this.noteId}, title=${this.title})`;
    }
}

class Branch {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        this.branchId = row.branchId;
        this.noteId = row.noteId;
        this.note = null;
        this.parentNoteId = row.parentNoteId;
        this.notePosition = row.notePosition;
        this.prefix = row.prefix;
        this.isExpanded = row.isExpanded;
    }

    async getNote() {
        return this.treeCache.getNote(this.noteId);
    }

    get toString() {
        return `Branch(branchId=${this.branchId})`;
    }
}

const treeService = (function() {
    let treeCache;

    const $tree = $("#tree");
    const $parentList = $("#parent-list");
    const $parentListList = $("#parent-list-inner");
    const $createTopLevelNoteButton = $("#create-top-level-note-button");
    const $collapseTreeButton = $("#collapse-tree-button");
    const $scrollToCurrentNoteButton = $("#scroll-to-current-note-button");

    let instanceName = null; // should have better place

    let startNotePath = null;

    /** @type {Object.<string, NoteShort>} */
    let noteMap = {};
    /** @type {Object.<string, Branch>} */
    let branchMap = {};

    function getNote(noteId) {
        const note = noteMap[noteId];

        if (!note) {
            utils.throwError("Can't find title for noteId='" + noteId + "'");
        }

        return note;
    }

    function getNoteTitle(noteId, parentNoteId = null) {
        utils.assertArguments(noteId);

        let title = treeCache.getNote(noteId).title;

        if (parentNoteId !== null) {
            const branch = treeCache.getBranch(noteId, parentNoteId);

            if (branch && branch.prefix) {
                title = branch.prefix + ' - ' + title;
            }
        }

        return title;
    }

    // note that if you want to access data like noteId or isProtected, you need to go into "data" property
    function getCurrentNode() {
        return $tree.fancytree("getActiveNode");
    }

    function getCurrentNotePath() {
        const node = getCurrentNode();

        return treeUtils.getNotePath(node);
    }

    function getNodesByBranchId(branchId) {
        utils.assertArguments(branchId);

        const branch = branchMap[branchId];

        return getNodesByNoteId(branch.noteId).filter(node => node.data.branchId === branchId);
    }

    function getNodesByNoteId(noteId) {
        utils.assertArguments(noteId);

        const list = getTree().getNodesByRef(noteId);
        return list ? list : []; // if no nodes with this refKey are found, fancy tree returns null
    }

    function setPrefix(branchId, prefix) {
        utils.assertArguments(branchId);

        branchMap[branchId].prefix = prefix;

        getNodesByBranchId(branchId).map(node => setNodeTitleWithPrefix(node));
    }

    function setNodeTitleWithPrefix(node) {
        const noteTitle = getNoteTitle(node.data.noteId);
        const branch = branchMap[node.data.branchId];

        const prefix = branch.prefix;

        const title = (prefix ? (prefix + " - ") : "") + noteTitle;

        node.setTitle(utils.escapeHtml(title));
    }

    function removeParentChildRelation(parentNoteId, childNoteId) {
        utils.assertArguments(parentNoteId, childNoteId);

        const parentNote = noteMap[parentNoteId];
        const childNote = noteMap[childNoteId];

        // FIXME
    }

    function setParentChildRelation(branchId, parentNoteId, childNoteId) {
        utils.assertArguments(branchId, parentNoteId, childNoteId);

        const parentNote = noteMap[parentNoteId];
        const childNote = noteMap[childNoteId];

        // FIXME: assert
    }

    async function prepareBranch(noteRows, branchRows) {
        utils.assertArguments(noteRows);

        treeCache = new TreeCache(noteRows, branchRows);

        return await prepareBranchInner(treeCache.getNote('root'));
    }

    async function getExtraClasses(note) {
        utils.assertArguments(note);

        const extraClasses = [];

        if (note.isProtected) {
            extraClasses.push("protected");
        }

        if ((await note.getParentNotes()).length > 1) {
            extraClasses.push("multiple-parents");
        }

        extraClasses.push(note.type);

        return extraClasses.join(" ");
    }

    async function prepareBranchInner(parentNote) {
        utils.assertArguments(parentNote);

        const childBranches = await parentNote.getChildBranches();

        if (!childBranches) {
            messaging.logError(`No children for ${parentNote}. This shouldn't happen.`);
            return;
        }

        const noteList = [];

        for (const branch of childBranches) {
            const note = await branch.getNote();
            const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;

            const node = {
                noteId: note.noteId,
                parentNoteId: branch.parentNoteId,
                branchId: branch.branchId,
                isProtected: note.isProtected,
                title: utils.escapeHtml(title),
                extraClasses: getExtraClasses(note),
                refKey: note.noteId,
                expanded: note.type !== 'search' && branch.isExpanded
            };

            const hasChildren = (await note.getChildNotes()).length > 0;

            if (hasChildren || note.type === 'search') {
                node.folder = true;

                if (node.expanded && note.type !== 'search') {
                    node.children = await prepareBranchInner(note);
                }
                else {
                    node.lazy = true;
                }
            }

            noteList.push(node);
        }

        return noteList;
    }

    async function expandToNote(notePath, expandOpts) {
        utils.assertArguments(notePath);

        const runPath = await getRunPath(notePath);

        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        let parentNoteId = 'root';

        for (const childNoteId of runPath) {
            const node = getNodesByNoteId(childNoteId).find(node => node.data.parentNoteId === parentNoteId);

            if (childNoteId === noteId) {
                return node;
            }
            else {
                await node.setExpanded(true, expandOpts);
            }

            parentNoteId = childNoteId;
        }
    }

    async function activateNode(notePath) {
        utils.assertArguments(notePath);

        const node = await expandToNote(notePath);

        await node.setActive();

        clearSelectedNodes();
    }

    /**
     * Accepts notePath and tries to resolve it. Part of the path might not be valid because of note moving (which causes
     * path change) or other corruption, in that case this will try to get some other valid path to the correct note.
     */
    async function getRunPath(notePath) {
        utils.assertArguments(notePath);

        const path = notePath.split("/").reverse();
        path.push('root');

        const effectivePath = [];
        let childNoteId = null;
        let i = 0;

        while (true) {
            if (i >= path.length) {
                break;
            }

            const parentNoteId = path[i++];

            if (childNoteId !== null) {
                const child = treeCache.getNote(childNoteId);
                const parents = await child.getParentNotes();

                if (!parents) {
                    messaging.logError("No parents found for " + childNoteId);
                    return;
                }

                if (!parents.some(p => p.noteId === parentNoteId)) {
                    console.log(utils.now(), "Did not find parent " + parentNoteId + " for child " + childNoteId);

                    if (parents.length > 0) {
                        console.log(utils.now(), "Available parents:", parents);

                        const someNotePath = await getSomeNotePath(parents[0]);

                        if (someNotePath) { // in case it's root the path may be empty
                            const pathToRoot = someNotePath.split("/").reverse();

                            for (const noteId of pathToRoot) {
                                effectivePath.push(noteId);
                            }
                        }

                        break;
                    }
                    else {
                        messaging.logError("No parents, can't activate node.");
                        return;
                    }
                }
            }

            if (parentNoteId === 'root') {
                break;
            }
            else {
                effectivePath.push(parentNoteId);
                childNoteId = parentNoteId;
            }
        }

        return effectivePath.reverse();
    }

    async function showParentList(noteId, node) {
        utils.assertArguments(noteId, node);

        const note = treeCache.getNote(noteId);
        const parents = await note.getParentNotes();

        if (!parents.length) {
            utils.throwError("Can't find parents for noteId=" + noteId);
        }

        if (parents.length <= 1) {
            $parentList.hide();
        }
        else {
            $parentList.show();
            $parentListList.empty();

            for (const parentNote of parents) {
                const parentNotePath = await getSomeNotePath(parentNote);
                // this is to avoid having root notes leading '/'
                const notePath = parentNotePath ? (parentNotePath + '/' + noteId) : noteId;
                const title = getNotePathTitle(notePath);

                let item;

                if (node.getParent().data.noteId === parentNote.noteId) {
                    item = $("<span/>").attr("title", "Current note").append(title);
                }
                else {
                    item = link.createNoteLink(notePath, title);
                }

                $parentListList.append($("<li/>").append(item));
            }
        }
    }

    function getNotePathTitle(notePath) {
        utils.assertArguments(notePath);

        const titlePath = [];

        let parentNoteId = 'root';

        for (const noteId of notePath.split('/')) {
            titlePath.push(getNoteTitle(noteId, parentNoteId));

            parentNoteId = noteId;
        }

        return titlePath.join(' / ');
    }

    async function getSomeNotePath(note) {
        utils.assertArguments(note);

        const path = [];

        let cur = note;

        while (cur.noteId !== 'root') {
            path.push(cur.noteId);

            const parents = await cur.getParentNotes();

            if (!parents.length) {
                utils.throwError("Can't find parents for " + cur);
            }

            cur = parents[0];
        }

        return path.reverse().join('/');
    }

    async function setExpandedToServer(branchId, isExpanded) {
        utils.assertArguments(branchId);

        const expandedNum = isExpanded ? 1 : 0;

        await server.put('tree/' + branchId + '/expanded/' + expandedNum);
    }

    function setCurrentNotePathToHash(node) {
        utils.assertArguments(node);

        const currentNotePath = treeUtils.getNotePath(node);
        const currentBranchId = node.data.branchId;

        document.location.hash = currentNotePath;

        recentNotes.addRecentNote(currentBranchId, currentNotePath);
    }

    function getSelectedNodes(stopOnParents = false) {
        return getTree().getSelectedNodes(stopOnParents);
    }

    function clearSelectedNodes() {
        for (const selectedNode of getSelectedNodes()) {
            selectedNode.setSelected(false);
        }

        const currentNode = getCurrentNode();

        if (currentNode) {
            currentNode.setSelected(true);
        }
    }

    function initFancyTree(branch) {
        utils.assertArguments(branch);

        const keybindings = {
            "del": node => {
                treeChanges.deleteNodes(getSelectedNodes(true));
            },
            "ctrl+up": node => {
                const beforeNode = node.getPrevSibling();

                if (beforeNode !== null) {
                    treeChanges.moveBeforeNode([node], beforeNode);
                }

                return false;
            },
            "ctrl+down": node => {
                let afterNode = node.getNextSibling();
                if (afterNode !== null) {
                    treeChanges.moveAfterNode([node], afterNode);
                }

                return false;
            },
            "ctrl+left": node => {
                treeChanges.moveNodeUpInHierarchy(node);

                return false;
            },
            "ctrl+right": node => {
                let toNode = node.getPrevSibling();

                if (toNode !== null) {
                    treeChanges.moveToNode([node], toNode);
                }

                return false;
            },
            "shift+up": node => {
                node.navigate($.ui.keyCode.UP, true).then(() => {
                    const currentNode = getCurrentNode();

                    if (currentNode.isSelected()) {
                        node.setSelected(false);
                    }

                    currentNode.setSelected(true);
                });

                return false;
            },
            "shift+down": node => {
                node.navigate($.ui.keyCode.DOWN, true).then(() => {
                    const currentNode = getCurrentNode();

                    if (currentNode.isSelected()) {
                        node.setSelected(false);
                    }

                    currentNode.setSelected(true);
                });

                return false;
            },
            "f2": node => {
                editTreePrefix.showDialog(node);
            },
            "alt+-": node => {
                collapseTree(node);
            },
            "alt+s": node => {
                sortAlphabetically(node.data.noteId);

                return false;
            },
            "ctrl+a": node => {
                for (const child of node.getParent().getChildren()) {
                    child.setSelected(true);
                }

                return false;
            },
            "ctrl+c": () => {
                contextMenu.copy(getSelectedNodes());

                return false;
            },
            "ctrl+x": () => {
                contextMenu.cut(getSelectedNodes());

                return false;
            },
            "ctrl+v": node => {
                contextMenu.pasteInto(node);

                return false;
            },
            "return": node => {
                noteEditor.focus();

                return false;
            },
            "backspace": node => {
                if (!utils.isTopLevelNode(node)) {
                    node.getParent().setActive().then(() => clearSelectedNodes());
                }
            },
            // code below shouldn't be necessary normally, however there's some problem with interaction with context menu plugin
            // after opening context menu, standard shortcuts don't work, but they are detected here
            // so we essentially takeover the standard handling with our implementation.
            "left": node => {
                node.navigate($.ui.keyCode.LEFT, true).then(() => clearSelectedNodes());

                return false;
            },
            "right": node => {
                node.navigate($.ui.keyCode.RIGHT, true).then(() => clearSelectedNodes());

                return false;
            },
            "up": node => {
                node.navigate($.ui.keyCode.UP, true).then(() => clearSelectedNodes());

                return false;
            },
            "down": node => {
                node.navigate($.ui.keyCode.DOWN, true).then(() => clearSelectedNodes());

                return false;
            }
        };

        $tree.fancytree({
            autoScroll: true,
            keyboard: false, // we takover keyboard handling in the hotkeys plugin
            extensions: ["hotkeys", "filter", "dnd", "clones"],
            source: branch,
            scrollParent: $("#tree"),
            click: (event, data) => {
                const targetType = data.targetType;
                const node = data.node;

                if (targetType === 'title' || targetType === 'icon') {
                    if (!event.ctrlKey) {
                        node.setActive();
                        node.setSelected(true);

                        clearSelectedNodes();
                    }
                    else {
                        node.setSelected(!node.isSelected());
                    }

                    return false;
                }
            },
            activate: (event, data) => {
                const node = data.node.data;

                setCurrentNotePathToHash(data.node);

                noteEditor.switchToNote(node.noteId);

                showParentList(node.noteId, data.node);
            },
            expand: (event, data) => {
                setExpandedToServer(data.node.data.branchId, true);
            },
            collapse: (event, data) => {
                setExpandedToServer(data.node.data.branchId, false);
            },
            init: (event, data) => {
                const noteId = treeUtils.getNoteIdFromNotePath(startNotePath);

                if (noteMap[noteId] === undefined) {
                    // note doesn't exist so don't try to activate it
                    startNotePath = null;
                }

                if (startNotePath) {
                    activateNode(startNotePath);

                    // looks like this this doesn't work when triggered immediatelly after activating node
                    // so waiting a second helps
                    setTimeout(scrollToCurrentNote, 1000);
                }
            },
            hotkeys: {
                keydown: keybindings
            },
            filter: {
                autoApply: true,   // Re-apply last filter if lazy data is loaded
                autoExpand: true, // Expand all branches that contain matches while filtered
                counter: false,     // Show a badge with number of matching child nodes near parent icons
                fuzzy: false,      // Match single characters in order, e.g. 'fb' will match 'FooBar'
                hideExpandedCounter: true,  // Hide counter badge if parent is expanded
                hideExpanders: false,       // Hide expanders if all child nodes are hidden by filter
                highlight: true,   // Highlight matches by wrapping inside <mark> tags
                leavesOnly: false, // Match end nodes only
                nodata: true,      // Display a 'no data' status node if result is empty
                mode: "hide"       // Grayout unmatched nodes (pass "hide" to remove unmatched node instead)
            },
            dnd: dragAndDropSetup,
            lazyLoad: async function(event, data){
                const noteId = data.node.data.noteId;
                const note = getNote(noteId);

                if (note.type === 'search') {
                    data.result = loadSearchNote(noteId);
                }
                else {
                    data.result = await prepareBranchInner(note);
                }
            },
            clones: {
                highlightActiveClones: true
            }
        });

        $tree.contextmenu(contextMenu.contextMenuSettings);
    }

    async function loadSearchNote(searchNoteId) {
        const note = await server.get('notes/' + searchNoteId);

        const json = JSON.parse(note.detail.content);

        const noteIds = await server.get('search/' + encodeURIComponent(json.searchString));

        for (const noteId of noteIds) {
            const branchId = "virt" + utils.randomString(10);

            branchMap[branchId] = {
                branchId: branchId,
                noteId: noteId,
                parentNoteId: searchNoteId,
                prefix: '',
                virtual: true
            };

            setParentChildRelation(branchId, searchNoteId, noteId);
        }

        return await prepareBranchInner(searchNoteId);
    }

    function getTree() {
        return $tree.fancytree('getTree');
    }

    async function reload() {
        const notes = await loadTree();

        // this will also reload the note content
        await getTree().reload(notes);
    }

    function getNotePathFromAddress() {
        return document.location.hash.substr(1); // strip initial #
    }

    async function loadTree() {
        const resp = await server.get('tree');
        startNotePath = resp.start_note_path;
        instanceName = resp.instanceName;

        if (document.location.hash) {
            startNotePath = getNotePathFromAddress();
        }

        return await prepareBranch(resp.notes, resp.branches);
    }

    $(() => loadTree().then(branch => initFancyTree(branch)));

    function collapseTree(node = null) {
        if (!node) {
            node = $tree.fancytree("getRootNode");
        }

        node.setExpanded(false);

        node.visit(node => node.setExpanded(false));
    }

    $(document).bind('keydown', 'alt+c', () => collapseTree()); // don't use shortened form since collapseTree() accepts argument

    function scrollToCurrentNote() {
        const node = getCurrentNode();

        if (node) {
            node.makeVisible({scrollIntoView: true});

            node.setFocus();
        }
    }

    function setBranchBackgroundBasedOnProtectedStatus(noteId) {
        getNodesByNoteId(noteId).map(node => node.toggleClass("protected", !!node.data.isProtected));
    }

    function setProtected(noteId, isProtected) {
        getNodesByNoteId(noteId).map(node => node.data.isProtected = isProtected);

        setBranchBackgroundBasedOnProtectedStatus(noteId);
    }

    async function getAutocompleteItems(parentNoteId, notePath, titlePath) {
        if (!parentNoteId) {
            parentNoteId = 'root';
        }

        const parentNote = treeCache.getNote(parentNoteId);
        const childNotes = await parentNote.getChildNotes();

        if (!childNotes.length) {
            return [];
        }

        if (!notePath) {
            notePath = '';
        }

        if (!titlePath) {
            titlePath = '';
        }

        // https://github.com/zadam/trilium/issues/46
        // unfortunately not easy to implement because we don't have an easy access to note's isProtected property

        const autocompleteItems = [];

        for (const childNote of childNotes) {
            if (childNote.hideInAutocomplete) {
                continue;
            }

            const childNotePath = (notePath ? (notePath + '/') : '') + childNote.noteId;
            const childTitlePath = (titlePath ? (titlePath + ' / ') : '') + getNoteTitle(childNote.noteId, parentNoteId);

            autocompleteItems.push({
                value: childTitlePath + ' (' + childNotePath + ')',
                label: childTitlePath
            });

            const childItems = await getAutocompleteItems(childNote.noteId, childNotePath, childTitlePath);

            for (const childItem of childItems) {
                autocompleteItems.push(childItem);
            }
        }

        return autocompleteItems;
    }

    function setNoteTitle(noteId, title) {
        utils.assertArguments(noteId);

        getNote(noteId).title = title;

        getNodesByNoteId(noteId).map(clone => setNodeTitleWithPrefix(clone));
    }

    async function createNewTopLevelNote() {
        const rootNode = $tree.fancytree("getRootNode");

        await createNote(rootNode, "root", "into");
    }

    async function createNote(node, parentNoteId, target, isProtected) {
        utils.assertArguments(node, parentNoteId, target);

        // if isProtected isn't available (user didn't enter password yet), then note is created as unencrypted
        // but this is quite weird since user doesn't see WHERE the note is being created so it shouldn't occur often
        if (!isProtected || !protected_session.isProtectedSessionAvailable()) {
            isProtected = false;
        }

        const newNoteName = "new note";

        const result = await server.post('notes/' + parentNoteId + '/children', {
            title: newNoteName,
            target: target,
            target_branchId: node.data.branchId,
            isProtected: isProtected
        });

        setParentChildRelation(result.branchId, parentNoteId, result.noteId);

        branchMap[result.branchId] = result;

        noteMap[result.noteId] = {
            noteId: result.noteId,
            title: result.title,
            isProtected: result.isProtected,
            type: result.type,
            mime: result.mime
        };

        noteEditor.newNoteCreated();

        const newNode = {
            title: newNoteName,
            noteId: result.noteId,
            parentNoteId: parentNoteId,
            refKey: result.noteId,
            branchId: result.branchId,
            isProtected: isProtected,
            extraClasses: getExtraClasses(result.note)
        };

        if (target === 'after') {
            await node.appendSibling(newNode).setActive(true);
        }
        else if (target === 'into') {
            if (!node.getChildren() && node.isFolder()) {
                await node.setExpanded();
            }
            else {
                node.addChildren(newNode);
            }

            await node.getLastChild().setActive(true);

            node.folder = true;
            node.renderTitle();
        }
        else {
            utils.throwError("Unrecognized target: " + target);
        }

        clearSelectedNodes(); // to unmark previously active node

        utils.showMessage("Created!");
    }

    async function sortAlphabetically(noteId) {
        await server.put('notes/' + noteId + '/sort');

        await reload();
    }

    async function noteExists(noteId) {
        return !!treeCache.getNote(noteId);
    }

    function getInstanceName() {
        return instanceName;
    }

    function getBranch(branchId) {
        return branchMap[branchId];
    }

    $(document).bind('keydown', 'ctrl+o', e => {
        const node = getCurrentNode();
        const parentNoteId = node.data.parentNoteId;
        const isProtected = treeUtils.getParentProtectedStatus(node);

        createNote(node, parentNoteId, 'after', isProtected);

        e.preventDefault();
    });

    $(document).bind('keydown', 'ctrl+p', e => {
        const node = getCurrentNode();

        createNote(node, node.data.noteId, 'into', node.data.isProtected);

        e.preventDefault();
    });

    $(document).bind('keydown', 'ctrl+del', e => {
        const node = getCurrentNode();

        treeChanges.deleteNodes([node]);

        e.preventDefault();
    });

    $(document).bind('keydown', 'ctrl+.', scrollToCurrentNote);

    $(window).bind('hashchange', function() {
        const notePath = getNotePathFromAddress();

        if (getCurrentNotePath() !== notePath) {
            console.log("Switching to " + notePath + " because of hash change");

            activateNode(notePath);
        }
    });

    if (utils.isElectron()) {
        $(document).bind('keydown', 'alt+left', e => {
            window.history.back();

            e.preventDefault();
        });

        $(document).bind('keydown', 'alt+right', e => {
            window.history.forward();

            e.preventDefault();
        });
    }

    $createTopLevelNoteButton.click(createNewTopLevelNote);
    $collapseTreeButton.click(collapseTree);
    $scrollToCurrentNoteButton.click(scrollToCurrentNote);

    return {
        reload,
        collapseTree,
        scrollToCurrentNote,
        setBranchBackgroundBasedOnProtectedStatus,
        setProtected,
        getCurrentNode,
        expandToNote,
        activateNode,
        getCurrentNotePath,
        getNoteTitle,
        setCurrentNotePathToHash,
        getAutocompleteItems,
        setNoteTitle,
        createNewTopLevelNote,
        createNote,
        setPrefix,
        getNotePathTitle,
        removeParentChildRelation,
        setParentChildRelation,
        getSelectedNodes,
        sortAlphabetically,
        noteExists,
        getInstanceName,
        getBranch,
        getNote
    };
})();