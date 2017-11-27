"use strict";

const noteTree = (function() {
    const treeEl = $("#tree");
    const parentListEl = $("#parent-list");

    let startNoteTreeId = null;
    let treeLoadTime = null;
    let notesTreeMap = {};

    let parentToChildren = {};
    let childToParents = {};

    let parentChildToNoteTreeId = {};
    let noteIdToTitle = {};

    function getTreeLoadTime() {
        return treeLoadTime;
    }

    function getNoteTreeId(parentNoteId, childNoteId) {
        const key = parentNoteId + "-" + childNoteId;

        const noteTreeId = parentChildToNoteTreeId[key];

        if (!noteTreeId) {
            console.trace();

            throw new Error("Can't find note tree id for parent=" + parentNoteId + ", child=" + childNoteId);
        }

        return noteTreeId;
    }

    function getNoteTitle(notePath) {
        const noteId = treeUtils.getNoteIdFromNotePath(notePath);
        const title = noteIdToTitle[noteId];

        if (!title) {
            throw new Error("Can't find title for noteId='" + noteId + "'");
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

    function getCurrentNoteId() {
        const node = getCurrentNode();

        return node ? node.data.note_id : null;
    }

    function getCurrentClones() {
        const noteId = getCurrentNoteId();

        if (noteId) {
            return getNodes(noteId);
        }
        else {
            return [];
        }
    }

    function getNodes(noteId) {
        return getTree().getNodesByRef(noteId);
    }

    function prepareNoteTree(notes) {
        parentToChildren = {};
        childToParents = {};
        notesTreeMap = {};

        for (const note of notes) {
            notesTreeMap[note.note_tree_id] = note;

            noteIdToTitle[note.note_id] = note.note_title;

            delete note.note_title; // this should not be used. Use noteIdToTitle instead

            const key = note.note_pid + "-" + note.note_id;

            parentChildToNoteTreeId[key] = note.note_tree_id;

            if (!parentToChildren[note.note_pid]) {
                parentToChildren[note.note_pid] = [];
            }

            parentToChildren[note.note_pid].push(note.note_id);

            if (!childToParents[note.note_id]) {
                childToParents[note.note_id] = [];
            }

            childToParents[note.note_id].push(note.note_pid);
        }

        return prepareNoteTreeInner('root');
    }

    function getExtraClasses(note) {
        let extraClasses = '';

        if (note.is_protected) {
            extraClasses += ",protected";
        }

        if (childToParents[note.note_id].length > 1) {
            extraClasses += ",multiple-parents";
        }

        if (extraClasses.startsWith(",")) {
            extraClasses = extraClasses.substr(1);
        }

        return extraClasses;
    }

    function prepareNoteTreeInner(parentNoteId) {
        const childNoteIds = parentToChildren[parentNoteId];
        if (!childNoteIds) {
            console.log("No children for " + parentNoteId + ". This shouldn't happen.");
            return;
        }

        const noteList = [];

        for (const noteId of childNoteIds) {
            const noteTreeId = getNoteTreeId(parentNoteId, noteId);
            const noteTree = notesTreeMap[noteTreeId];

            const node = {
                note_id: noteTree.note_id,
                note_pid: noteTree.note_pid,
                note_tree_id: noteTree.note_tree_id,
                is_protected: noteTree.is_protected,
                prefix: noteTree.prefix,
                title: (noteTree.prefix ? (noteTree.prefix + " - ") : "") + noteIdToTitle[noteTree.note_id],
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
        const path = notePath.split("/").reverse();

        const effectivePath = [];
        let childNoteId = null;
        let i = 0;

        while (true) {
            const parentNoteId = i < path.length ? path[i] : null;
            i++;

            if (childNoteId !== null) {
                const parents = childToParents[childNoteId];

                if (!parents) {
                    console.error("No parents found for " + childNoteId);
                    return;
                }

                if (parentNoteId === null || !parents.includes(parentNoteId)) {
                    console.log("Did not find parent " + parentNoteId + " for child " + childNoteId);

                    if (parents.length > 0) {
                        if (parents[0] === 'root') {
                            console.log("Reached root.");
                            break;
                        }

                        childNoteId = parents[0];
                        effectivePath.push(childNoteId);

                        console.log("Choosing parent " + childNoteId + " instead.");
                        continue;
                    }
                    else {
                        console.log("No parents, can't activate node.");
                        return;
                    }
                }
            }

            effectivePath.push(parentNoteId);
            childNoteId = parentNoteId;
        }

        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        const runPath = effectivePath.reverse();
        let parentNoteId = 'root';

        for (const childNoteId of runPath) {
            const node = getNodes(childNoteId).find(node => node.data.note_pid === parentNoteId);

            if (childNoteId === noteId) {
                await node.setActive();
            }
            else {
                await node.setExpanded();
            }

            parentNoteId = childNoteId;
        }
    }

    function showParentList(noteId, node) {
        const parents = childToParents[noteId];

        if (!parents) {
            throw new Error("Can't find parents for noteId=" + noteId);
        }

        if (parents.length <= 1) {
            parentListEl.hide();
        }
        else {
            parentListEl.show();
            parentListEl.empty();

            const list = $("<ul/>");

            for (const parentNoteId of parents) {
                const notePath = getSomeNotePath(parentNoteId) + '/' + noteId;
                const title = getNotePathTitle(notePath);

                let item;

                if (node.getParent().data.note_id === parentNoteId) {
                    item = $("<span/>").attr("title", "Current note").append(title);
                }
                else {
                    item = link.createNoteLink(notePath, title);
                }

                list.append($("<li/>").append(item));
            }

            parentListEl.append(list);
        }
    }

    function getNotePathTitle(notePath) {
        const titlePath = [];

        for (const path of notePath.split('/')) {
            titlePath.push(getNoteTitle(path));
        }

        return titlePath.join(' / ');
    }

    function getSomeNotePath(noteId) {
        const path = [];

        let cur = noteId;

        while (cur !== 'root') {
            path.push(cur);

            cur = childToParents[cur][0];
        }

        return path.reverse().join('/');
    }

    function setExpandedToServer(noteTreeId, isExpanded) {
        const expandedNum = isExpanded ? 1 : 0;

        $.ajax({
            url: baseApiUrl + 'notes/' + noteTreeId + '/expanded/' + expandedNum,
            type: 'PUT',
            contentType: "application/json",
            success: result => {}
        });
    }

    function setCurrentNotePathToHash(node) {
        const currentNotePath = treeUtils.getNotePath(node);

        document.location.hash = currentNotePath;

        recentNotes.addRecentNote(currentNotePath);
    }

    function initFancyTree(noteTree) {
        const keybindings = {
            "insert": node => {
                const parentNoteId = node.data.note_pid;
                const isProtected = treeUtils.getParentProtectedStatus(node);

                createNote(node, parentNoteId, 'after', isProtected);
            },
            "ctrl+insert": node => {
                createNote(node, node.data.note_id, 'into', node.data.is_protected);
            },
            "del": node => {
                treeChanges.deleteNode(node);
            },
            "shift+up": node => {
                const beforeNode = node.getPrevSibling();

                if (beforeNode !== null) {
                    treeChanges.moveBeforeNode(node, beforeNode);
                }
            },
            "shift+down": node => {
                let afterNode = node.getNextSibling();
                if (afterNode !== null) {
                    treeChanges.moveAfterNode(node, afterNode);
                }
            },
            "shift+left": node => {
                treeChanges.moveNodeUp(node);
            },
            "shift+right": node => {
                let toNode = node.getPrevSibling();

                if (toNode !== null) {
                    treeChanges.moveToNode(node, toNode);
                }
            },
            "f2": node => {
                editTreePrefix.showDialog();
            }
        };

        treeEl.fancytree({
            autoScroll: true,
            extensions: ["hotkeys", "filter", "dnd", "clones"],
            source: noteTree,
            scrollParent: $("#tree"),
            activate: (event, data) => {
                const node = data.node.data;

                setCurrentNotePathToHash(data.node);

                noteEditor.switchToNote(node.note_id);

                showParentList(node.note_id, data.node);
                return false;
            },
            expand: (event, data) => {
                setExpandedToServer(data.node.data.note_tree_id, true);
            },
            collapse: (event, data) => {
                setExpandedToServer(data.node.data.note_tree_id, false);
            },
            init: (event, data) => {
                if (startNoteTreeId) {
                    activateNode(startNoteTreeId);
                }
                else {
                    showAppIfHidden();
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
            keydown: (event, data) => {
                const node = data.node;
                // Eat keyboard events, when a menu is open
                if ($(".contextMenu:visible").length > 0)
                    return false;

                switch (event.which) {
                    // Open context menu on [Space] key (simulate right click)
                    case 32: // [Space]
                        $(node.span).trigger("mousedown", {
                            preventDefault: true,
                            button: 2
                        })
                            .trigger("mouseup", {
                                preventDefault: true,
                                pageX: node.span.offsetLeft,
                                pageY: node.span.offsetTop,
                                button: 2
                            });
                        return false;

                    // Handle Ctrl-C, -X and -V
                    // case 67:
                    //     if (event.ctrlKey) { // Ctrl-C
                    //         copyPaste("copy", node);
                    //         return false;
                    //     }
                    //     break;
                    case 86:
                        console.log("CTRL-V");

                        if (event.ctrlKey) { // Ctrl-V
                            contextMenu.pasteAfter(node);
                            return false;
                        }
                        break;
                    case 88:
                        console.log("CTRL-X");

                        if (event.ctrlKey) { // Ctrl-X
                            contextMenu.cut(node);
                            return false;
                        }
                        break;
                }
            },
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

    function loadTree() {
        return $.get(baseApiUrl + 'tree').then(resp => {
            startNoteTreeId = resp.start_note_tree_id;
            treeLoadTime = resp.tree_load_time;

            if (document.location.hash) {
                startNoteTreeId = document.location.hash.substr(1); // strip initial #
            }

            return prepareNoteTree(resp.notes, resp.notes_parent);
        });
    }

    $(() => loadTree().then(noteTree => initFancyTree(noteTree)));

    function collapseTree() {
        treeEl.fancytree("getRootNode").visit(node => {
            node.setExpanded(false);
        });
    }

    $(document).bind('keydown', 'alt+c', collapseTree);

    function scrollToCurrentNote() {
        const node = noteTree.getCurrentNode();

        if (node) {
            node.makeVisible({scrollIntoView: true});

            node.setFocus();
        }
    }

    function setCurrentNoteTreeBasedOnProtectedStatus() {
        getCurrentClones().map(node => node.toggleClass("protected", !!node.data.is_protected));
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
            const childTitlePath = (titlePath ? (titlePath + ' / ') : '') + getNoteTitle(childNoteId);

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

    function setCurrentNoteTitle(title) {
        const currentNoteId = getCurrentNoteId();

        if (currentNoteId) {
            noteIdToTitle[currentNoteId] = title;

            getCurrentClones().map(clone => {
                const fullTitle = (clone.data.prefix ? (clone.data.prefix + " - ") : "") + title;

                clone.setTitle(fullTitle)
            });
        }
    }

    async function createNewTopLevelNote() {
        const rootNode = treeEl.fancytree("getRootNode");

        await createNote(rootNode, "root", "into");
    }

    async function createNote(node, parentNoteId, target, isProtected) {
        // if isProtected isn't available (user didn't enter password yet), then note is created as unencrypted
        // but this is quite weird since user doesn't see WHERE the note is being created so it shouldn't occur often
        if (!isProtected || !protected_session.isProtectedSessionAvailable()) {
            isProtected = false;
        }

        const newNoteName = "new note";

        const result = await $.ajax({
            url: baseApiUrl + 'notes/' + parentNoteId + '/children' ,
            type: 'POST',
            data: JSON.stringify({
                note_title: newNoteName,
                target: target,
                target_note_tree_id: node.data.note_tree_id,
                is_protected: isProtected
            }),
            contentType: "application/json"
        });

        const newNode = {
            title: newNoteName,
            note_id: result.note_id,
            note_pid: parentNoteId,
            refKey: result.note_id,
            note_tree_id: result.note_tree_id,
            is_protected: isProtected,
            extraClasses: isProtected ? "protected" : ""
        };

        parentToChildren[parentNoteId].push(result.note_id);
        parentToChildren[result.note_id] = [];
        childToParents[result.note_id] = [ parentNoteId ];

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

    return {
        getTreeLoadTime,
        reload,
        collapseTree,
        scrollToCurrentNote,
        setCurrentNoteTreeBasedOnProtectedStatus,
        getCurrentNode,
        activateNode,
        getCurrentNotePath,
        getNoteTitle,
        setCurrentNotePathToHash,
        getAutocompleteItems,
        setCurrentNoteTitle,
        createNewTopLevelNote,
        createNote
    };
})();