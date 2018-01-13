"use strict";

const noteTree = (function() {
    const treeEl = $("#tree");
    const parentListEl = $("#parent-list");
    const parentListListEl = $("#parent-list-list");
    const noteDetailEl = $("#note-detail");

    let startNotePath = null;
    let notesTreeMap = {};

    let parentToChildren = {};
    let childToParents = {};

    let parentChildToNoteTreeId = {};
    let noteIdToTitle = {};

    function getNoteTreeId(parentNoteId, childNoteId) {
        assertArguments(parentNoteId, childNoteId);

        const key = parentNoteId + "-" + childNoteId;

        // this can return undefined and client code should deal with it somehow

        return parentChildToNoteTreeId[key];
    }

    function getNoteTitle(noteId, parentNoteId = null) {
        assertArguments(noteId);

        let title = noteIdToTitle[noteId];

        if (!title) {
            throwError("Can't find title for noteId='" + noteId + "'");
        }

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

    // note that if you want to access data like note_id or is_protected, you need to go into "data" property
    function getCurrentNode() {
        return treeEl.fancytree("getActiveNode");
    }

    function getCurrentNotePath() {
        const node = getCurrentNode();

        return treeUtils.getNotePath(node);
    }

    function getNodesByNoteTreeId(noteTreeId) {
        assertArguments(noteTreeId);

        const noteTree = notesTreeMap[noteTreeId];

        return getNodesByNoteId(noteTree.note_id).filter(node => node.data.note_tree_id === noteTreeId);
    }

    function getNodesByNoteId(noteId) {
        assertArguments(noteId);

        const list = getTree().getNodesByRef(noteId);
        return list ? list : []; // if no nodes with this refKey are found, fancy tree returns null
    }

    function setPrefix(noteTreeId, prefix) {
        assertArguments(noteTreeId);

        notesTreeMap[noteTreeId].prefix = prefix;

        getNodesByNoteTreeId(noteTreeId).map(node => {
            node.data.prefix = prefix;

            treeUtils.setNodeTitleWithPrefix(node);
        });
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
            notesTreeMap[note.note_tree_id] = note;

            noteIdToTitle[note.note_id] = note.note_title;

            delete note.note_title; // this should not be used. Use noteIdToTitle instead

            setParentChildRelation(note.note_tree_id, note.parent_note_id, note.note_id);
        }

        return prepareNoteTreeInner('root');
    }

    function getExtraClasses(note) {
        assertArguments(note);

        const extraClasses = [];

        if (note.is_protected) {
            extraClasses.push("protected");
        }

        if (childToParents[note.note_id].length > 1) {
            extraClasses.push("multiple-parents");
        }

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
            const noteTreeId = getNoteTreeId(parentNoteId, noteId);
            const noteTree = notesTreeMap[noteTreeId];

            const title = (noteTree.prefix ? (noteTree.prefix + " - ") : "") + noteIdToTitle[noteTree.note_id];

            const node = {
                note_id: noteTree.note_id,
                parent_note_id: noteTree.parent_note_id,
                note_tree_id: noteTree.note_tree_id,
                is_protected: noteTree.is_protected,
                prefix: noteTree.prefix,
                title: escapeHtml(title),
                extraClasses: getExtraClasses(noteTree),
                refKey: noteTree.note_id,
                expanded: noteTree.is_expanded
            };

            if (parentToChildren[noteId] && parentToChildren[noteId].length > 0) {
                node.folder = true;

                if (node.expanded) {
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

    async function activateNode(notePath) {
        assertArguments(notePath);

        const runPath = getRunPath(notePath);

        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        let parentNoteId = 'root';

        for (const childNoteId of runPath) {
            const node = getNodesByNoteId(childNoteId).find(node => node.data.parent_note_id === parentNoteId);

            if (childNoteId === noteId) {
                await node.setActive();
            }
            else {
                await node.setExpanded();
            }

            parentNoteId = childNoteId;
        }

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
            parentListEl.hide();
        }
        else {
            parentListEl.show();
            parentListListEl.empty();

            for (const parentNoteId of parents) {
                const parentNotePath = getSomeNotePath(parentNoteId);
                // this is to avoid having root notes leading '/'
                const notePath = parentNotePath ? (parentNotePath + '/' + noteId) : noteId;
                const title = getNotePathTitle(notePath);

                let item;

                if (node.getParent().data.note_id === parentNoteId) {
                    item = $("<span/>").attr("title", "Current note").append(title);
                }
                else {
                    item = link.createNoteLink(notePath, title);
                }

                parentListListEl.append($("<li/>").append(item));
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

        await server.put('notes/' + noteTreeId + '/expanded/' + expandedNum);
    }

    function setCurrentNotePathToHash(node) {
        assertArguments(node);

        const currentNotePath = treeUtils.getNotePath(node);
        const currentNoteTreeId = node.data.note_tree_id;

        document.location.hash = currentNotePath;

        recentNotes.addRecentNote(currentNoteTreeId, currentNotePath);
    }

    function getSelectedNodes() {
        return getTree().getSelectedNodes();
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
                treeChanges.deleteNode(node);
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
                noteDetailEl.focus();
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

        treeEl.fancytree({
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

                noteEditor.switchToNote(node.note_id);

                showParentList(node.note_id, data.node);
            },
            expand: (event, data) => {
                setExpandedToServer(data.node.data.note_tree_id, true);
            },
            collapse: (event, data) => {
                setExpandedToServer(data.node.data.note_tree_id, false);
            },
            init: (event, data) => {
                const noteId = treeUtils.getNoteIdFromNotePath(startNotePath);

                if (noteIdToTitle[noteId] === undefined) {
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
                const node = data.node.data;

                data.result = prepareNoteTreeInner(node.note_id);
            },
            clones: {
                highlightActiveClones: true
            }
        });

        treeEl.contextmenu(contextMenu.contextMenuSettings);
    }

    function getTree() {
        return treeEl.fancytree('getTree');
    }

    async function reload() {
        const notes = await loadTree();

        // this will also reload the note content
        await getTree().reload(notes);
    }

    function getNotePathFromAddress() {
        return document.location.hash.substr(1); // strip initial #
    }

    function loadTree() {
        return server.get('tree').then(resp => {
            startNotePath = resp.start_note_path;

            if (document.location.hash) {
                startNotePath = getNotePathFromAddress();
            }

            return prepareNoteTree(resp.notes);
        });
    }

    $(() => loadTree().then(noteTree => initFancyTree(noteTree)));

    function collapseTree(node = null) {
        if (!node) {
            node = treeEl.fancytree("getRootNode");
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
        getNodesByNoteId(noteId).map(node => node.toggleClass("protected", !!node.data.is_protected));
    }

    function setProtected(noteId, isProtected) {
        getNodesByNoteId(noteId).map(node => node.data.is_protected = isProtected);

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

        const autocompleteItems = [];

        for (const childNoteId of parentToChildren[parentNoteId]) {
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

        noteIdToTitle[noteId] = title;

        getNodesByNoteId(noteId).map(clone => treeUtils.setNodeTitleWithPrefix(clone));
    }

    async function createNewTopLevelNote() {
        const rootNode = treeEl.fancytree("getRootNode");

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
            note_title: newNoteName,
            target: target,
            target_note_tree_id: node.data.note_tree_id,
            is_protected: isProtected
        });

        const newNode = {
            title: newNoteName,
            note_id: result.note_id,
            parent_note_id: parentNoteId,
            refKey: result.note_id,
            note_tree_id: result.note_tree_id,
            is_protected: isProtected,
            extraClasses: isProtected ? "protected" : ""
        };

        setParentChildRelation(result.note_tree_id, parentNoteId, result.note_id);

        notesTreeMap[result.note_tree_id] = result;

        noteIdToTitle[result.note_id] = newNoteName;

        noteEditor.newNoteCreated();

        if (target === 'after') {
            node.appendSibling(newNode).setActive(true);
        }
        else {
            node.addChildren(newNode).setActive(true);

            node.folder = true;
            node.renderTitle();
        }

        showMessage("Created!");
    }

    async function sortAlphabetically(noteId) {
        await server.put('notes/' + noteId + '/sort');

        await reload();
    }

    $(document).bind('keydown', 'ctrl+o', e => {
        console.log("pressed O");

        const node = getCurrentNode();
        const parentNoteId = node.data.parent_note_id;
        const isProtected = treeUtils.getParentProtectedStatus(node);

        createNote(node, parentNoteId, 'after', isProtected);

        e.preventDefault();
    });

    $(document).bind('keydown', 'ctrl+p', e => {
        const node = getCurrentNode();

        createNote(node, node.data.note_id, 'into', node.data.is_protected);

        e.preventDefault();
    });

    $(document).bind('keydown', 'ctrl+del', e => {
        const node = getCurrentNode();

        treeChanges.deleteNode(node);

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

    return {
        reload,
        collapseTree,
        scrollToCurrentNote,
        setNoteTreeBackgroundBasedOnProtectedStatus,
        setProtected,
        getCurrentNode,
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
        sortAlphabetically
    };
})();