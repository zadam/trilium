"use strict";

const noteTree = (function() {
    const $tree = $("#tree");
    const $parentList = $("#parent-list");
    const $parentListList = $("#parent-list-inner");
    const $createTopLevelNoteButton = $("#create-top-level-note-button");
    const $collapseTreeButton = $("#collapse-tree-button");
    const $scrollToCurrentNoteButton = $("#scroll-to-current-note-button");

    let instanceName = null; // should have better place

    let startNotePath = null;
    let notesTreeMap = {};

    let parentToChildren = {};
    let childToParents = {};

    let parentChildToNoteTreeId = {};
    let noteIdToNote = {};

    let hiddenInAutocomplete = {};

    function getNote(noteId) {
        const note = noteIdToNote[noteId];

        if (!note) {
            throwError("Can't find title for noteId='" + noteId + "'");
        }

        return note;
    }

    function getNoteTreeId(parentNoteId, childNoteId) {
        assertArguments(parentNoteId, childNoteId);

        const key = parentNoteId + "-" + childNoteId;

        // this can return undefined and client code should deal with it somehow

        return parentChildToNoteTreeId[key];
    }

    function getNoteTitle(noteId, parentNoteId = null) {
        assertArguments(noteId);

        let title = getNote(noteId).title;

        if (parentNoteId !== null) {
            const noteTreeId = getNoteTreeId(parentNoteId, noteId);

            if (noteTreeId) {
                const noteTree = notesTreeMap[noteTreeId];

                if (noteTree.prefix) {
                    title = noteTree.prefix + ' - ' + title;
                }
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

    function getNodesByNoteTreeId(noteTreeId) {
        assertArguments(noteTreeId);

        const noteTree = notesTreeMap[noteTreeId];

        return getNodesByNoteId(noteTree.noteId).filter(node => node.data.noteTreeId === noteTreeId);
    }

    function getNodesByNoteId(noteId) {
        assertArguments(noteId);

        const list = getTree().getNodesByRef(noteId);
        return list ? list : []; // if no nodes with this refKey are found, fancy tree returns null
    }

    function setPrefix(noteTreeId, prefix) {
        assertArguments(noteTreeId);

        notesTreeMap[noteTreeId].prefix = prefix;

        getNodesByNoteTreeId(noteTreeId).map(node => setNodeTitleWithPrefix(node));
    }

    function setNodeTitleWithPrefix(node) {
        const noteTitle = getNoteTitle(node.data.noteId);
        const noteTree = notesTreeMap[node.data.noteTreeId];

        const prefix = noteTree.prefix;

        const title = (prefix ? (prefix + " - ") : "") + noteTitle;

        node.setTitle(escapeHtml(title));
    }

    function removeParentChildRelation(parentNoteId, childNoteId) {
        assertArguments(parentNoteId, childNoteId);

        const key = parentNoteId + "-" + childNoteId;

        delete parentChildToNoteTreeId[key];

        parentToChildren[parentNoteId] = parentToChildren[parentNoteId].filter(noteId => noteId !== childNoteId);
        childToParents[childNoteId] = childToParents[childNoteId].filter(noteId => noteId !== parentNoteId);
    }

    function setParentChildRelation(noteTreeId, parentNoteId, childNoteId) {
        assertArguments(noteTreeId, parentNoteId, childNoteId);

        const key = parentNoteId + "-" + childNoteId;

        parentChildToNoteTreeId[key] = noteTreeId;

        if (!parentToChildren[parentNoteId]) {
            parentToChildren[parentNoteId] = [];
        }

        parentToChildren[parentNoteId].push(childNoteId);

        if (!childToParents[childNoteId]) {
            childToParents[childNoteId] = [];
        }

        childToParents[childNoteId].push(parentNoteId);
    }

    function prepareNoteTree(notes) {
        assertArguments(notes);

        parentToChildren = {};
        childToParents = {};
        notesTreeMap = {};

        for (const note of notes) {
            notesTreeMap[note.noteTreeId] = note;

            noteIdToNote[note.noteId] = {
                noteId: note.noteId,
                title: note.title,
                isProtected: note.isProtected,
                type: note.type,
                mime: note.mime
            };

            delete note.title; // this should not be used. Use noteIdToNote instead

            setParentChildRelation(note.noteTreeId, note.parentNoteId, note.noteId);
        }

        return prepareNoteTreeInner('root');
    }

    function getExtraClasses(note) {
        assertArguments(note);

        const extraClasses = [];

        if (note.isProtected) {
            extraClasses.push("protected");
        }

        if (childToParents[note.noteId].length > 1) {
            extraClasses.push("multiple-parents");
        }

        extraClasses.push(note.type);

        return extraClasses.join(" ");
    }

    function prepareNoteTreeInner(parentNoteId) {
        assertArguments(parentNoteId);

        const childNoteIds = parentToChildren[parentNoteId];
        if (!childNoteIds) {
            messaging.logError("No children for " + parentNoteId + ". This shouldn't happen.");
            return;
        }

        const noteList = [];

        for (const noteId of childNoteIds) {
            const note = getNote(noteId);
            const noteTreeId = getNoteTreeId(parentNoteId, noteId);
            const noteTree = notesTreeMap[noteTreeId];

            const title = (noteTree.prefix ? (noteTree.prefix + " - ") : "") + note.title;

            const node = {
                noteId: noteId,
                parentNoteId: noteTree.parentNoteId,
                noteTreeId: noteTree.noteTreeId,
                isProtected: note.isProtected,
                title: escapeHtml(title),
                extraClasses: getExtraClasses(note),
                refKey: noteId,
                expanded: note.type !== 'search' && noteTree.isExpanded
            };

            const hasChildren = parentToChildren[noteId] && parentToChildren[noteId].length > 0;

            if (hasChildren || note.type === 'search') {
                node.folder = true;

                if (node.expanded && note.type !== 'search') {
                    node.children = prepareNoteTreeInner(noteId);
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
        assertArguments(notePath);

        const runPath = getRunPath(notePath);

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
        assertArguments(notePath);

        const node = await expandToNote(notePath);

        await node.setActive();

        clearSelectedNodes();
    }

    /**
     * Accepts notePath and tries to resolve it. Part of the path might not be valid because of note moving (which causes
     * path change) or other corruption, in that case this will try to get some other valid path to the correct note.
     */
    function getRunPath(notePath) {
        assertArguments(notePath);

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
                const parents = childToParents[childNoteId];

                if (!parents) {
                    messaging.logError("No parents found for " + childNoteId);
                    return;
                }

                if (!parents.includes(parentNoteId)) {
                    console.log(now(), "Did not find parent " + parentNoteId + " for child " + childNoteId);

                    if (parents.length > 0) {
                        console.log(now(), "Available parents:", parents);

                        const someNotePath = getSomeNotePath(parents[0]);

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

    function showParentList(noteId, node) {
        assertArguments(noteId, node);

        const parents = childToParents[noteId];

        if (!parents) {
            throwError("Can't find parents for noteId=" + noteId);
        }

        if (parents.length <= 1) {
            $parentList.hide();
        }
        else {
            $parentList.show();
            $parentListList.empty();

            for (const parentNoteId of parents) {
                const parentNotePath = getSomeNotePath(parentNoteId);
                // this is to avoid having root notes leading '/'
                const notePath = parentNotePath ? (parentNotePath + '/' + noteId) : noteId;
                const title = getNotePathTitle(notePath);

                let item;

                if (node.getParent().data.noteId === parentNoteId) {
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
        assertArguments(notePath);

        const titlePath = [];

        let parentNoteId = 'root';

        for (const noteId of notePath.split('/')) {
            titlePath.push(getNoteTitle(noteId, parentNoteId));

            parentNoteId = noteId;
        }

        return titlePath.join(' / ');
    }

    function getSomeNotePath(noteId) {
        assertArguments(noteId);

        const path = [];

        let cur = noteId;

        while (cur !== 'root') {
            path.push(cur);

            if (!childToParents[cur]) {
                throwError("Can't find parents for " + cur);
            }

            cur = childToParents[cur][0];
        }

        return path.reverse().join('/');
    }

    async function setExpandedToServer(noteTreeId, isExpanded) {
        assertArguments(noteTreeId);

        const expandedNum = isExpanded ? 1 : 0;

        await server.put('tree/' + noteTreeId + '/expanded/' + expandedNum);
    }

    function setCurrentNotePathToHash(node) {
        assertArguments(node);

        const currentNotePath = treeUtils.getNotePath(node);
        const currentNoteTreeId = node.data.noteTreeId;

        document.location.hash = currentNotePath;

        recentNotes.addRecentNote(currentNoteTreeId, currentNotePath);
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

    function initFancyTree(noteTree) {
        assertArguments(noteTree);

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
                if (!isTopLevelNode(node)) {
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
            source: noteTree,
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
                setExpandedToServer(data.node.data.noteTreeId, true);
            },
            collapse: (event, data) => {
                setExpandedToServer(data.node.data.noteTreeId, false);
            },
            init: (event, data) => {
                const noteId = treeUtils.getNoteIdFromNotePath(startNotePath);

                if (noteIdToNote[noteId] === undefined) {
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
            lazyLoad: function(event, data){
                const noteId = data.node.data.noteId;
                const note = getNote(noteId);

                if (note.type === 'search') {
                    data.result = loadSearchNote(noteId);
                }
                else {
                    data.result = prepareNoteTreeInner(noteId);
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
            const noteTreeId = "virt" + randomString(10);

            notesTreeMap[noteTreeId] = {
                noteTreeId: noteTreeId,
                noteId: noteId,
                parentNoteId: searchNoteId,
                prefix: '',
                virtual: true
            };

            setParentChildRelation(noteTreeId, searchNoteId, noteId);
        }

        return prepareNoteTreeInner(searchNoteId);
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

        hiddenInAutocomplete = {};

        for (const noteId of resp.hiddenInAutocomplete) {
            hiddenInAutocomplete[noteId] = true;
        }

        return prepareNoteTree(resp.notes);
    }

    $(() => loadTree().then(noteTree => initFancyTree(noteTree)));

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

    function setNoteTreeBackgroundBasedOnProtectedStatus(noteId) {
        getNodesByNoteId(noteId).map(node => node.toggleClass("protected", !!node.data.isProtected));
    }

    function setProtected(noteId, isProtected) {
        getNodesByNoteId(noteId).map(node => node.data.isProtected = isProtected);

        setNoteTreeBackgroundBasedOnProtectedStatus(noteId);
    }

    function getAutocompleteItems(parentNoteId, notePath, titlePath) {
        if (!parentNoteId) {
            parentNoteId = 'root';
        }

        if (!parentToChildren[parentNoteId]) {
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

        for (const childNoteId of parentToChildren[parentNoteId]) {
            if (hiddenInAutocomplete[childNoteId]) {
                continue;
            }

            const childNotePath = (notePath ? (notePath + '/') : '') + childNoteId;
            const childTitlePath = (titlePath ? (titlePath + ' / ') : '') + getNoteTitle(childNoteId, parentNoteId);

            autocompleteItems.push({
                value: childTitlePath + ' (' + childNotePath + ')',
                label: childTitlePath
            });

            const childItems = getAutocompleteItems(childNoteId, childNotePath, childTitlePath);

            for (const childItem of childItems) {
                autocompleteItems.push(childItem);
            }
        }

        return autocompleteItems;
    }

    function setNoteTitle(noteId, title) {
        assertArguments(noteId);

        getNote(noteId).title = title;

        getNodesByNoteId(noteId).map(clone => setNodeTitleWithPrefix(clone));
    }

    async function createNewTopLevelNote() {
        const rootNode = $tree.fancytree("getRootNode");

        await createNote(rootNode, "root", "into");
    }

    async function createNote(node, parentNoteId, target, isProtected) {
        assertArguments(node, parentNoteId, target);

        // if isProtected isn't available (user didn't enter password yet), then note is created as unencrypted
        // but this is quite weird since user doesn't see WHERE the note is being created so it shouldn't occur often
        if (!isProtected || !protected_session.isProtectedSessionAvailable()) {
            isProtected = false;
        }

        const newNoteName = "new note";

        const result = await server.post('notes/' + parentNoteId + '/children', {
            title: newNoteName,
            target: target,
            target_noteTreeId: node.data.noteTreeId,
            isProtected: isProtected
        });

        setParentChildRelation(result.noteTreeId, parentNoteId, result.noteId);

        notesTreeMap[result.noteTreeId] = result;

        noteIdToNote[result.noteId] = {
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
            noteTreeId: result.noteTreeId,
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
            throwError("Unrecognized target: " + target);
        }

        clearSelectedNodes(); // to unmark previously active node

        showMessage("Created!");
    }

    async function sortAlphabetically(noteId) {
        await server.put('notes/' + noteId + '/sort');

        await reload();
    }

    function noteExists(noteId) {
        return !!childToParents[noteId];
    }

    function getInstanceName() {
        return instanceName;
    }

    function getNoteTree(noteTreeId) {
        return notesTreeMap[noteTreeId];
    }

    function getNote(noteId) {
        return noteIdToNote[noteId];
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

    if (isElectron()) {
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
        setNoteTreeBackgroundBasedOnProtectedStatus,
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
        getNoteTree,
        getNote
    };
})();