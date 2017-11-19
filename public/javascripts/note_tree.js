"use strict";

const noteTree = (function() {
    const noteDetailEl = $('#note-detail');
    const treeEl = $("#tree");
    let startNoteTreeId = null;
    let treeLoadTime = null;
    let clipboardNoteTreeId = null;
    let notesMap = {};
    let parentToChildren = {};
    let childToParents = {};
    let counter = 1;
    let noteTreeIdToKey = {};

    function getNoteTreeIdFromKey(key) {
        const node = treeUtils.getNodeByKey(key);

        return node.note_tree_id;
    }

    function getKeyFromNoteTreeId(noteTreeId) {
        return noteTreeIdToKey[noteTreeId];
    }

    function getTreeLoadTime() {
        return treeLoadTime;
    }

    function getClipboardNoteTreeId() {
        return clipboardNoteTreeId;
    }

    function setClipboardNoteTreeId(cbNoteId) {
        clipboardNoteTreeId = cbNoteId;
    }

    function prepareNoteTree(notes, notesParent) {
        parentToChildren = {};
        childToParents = {};
        notesMap = {};

        for (const note of notes) {
            notesMap[note.note_tree_id] = note;
        }

        for (const np of notesParent) {
            if (!parentToChildren[np.parent_id]) {
                parentToChildren[np.parent_id] = [];
            }

            parentToChildren[np.parent_id].push(np.child_id);

            if (!childToParents[np.child_id]) {
                childToParents[np.child_id] = [];
            }

            childToParents[np.child_id].push(np.parent_id);
        }

        glob.allNoteIds = Object.keys(notesMap);

        return prepareNoteTreeInner(parentToChildren['root']);
    }

    function prepareNoteTreeInner(noteTreeIds) {
        const noteList = [];

        for (const noteTreeId of noteTreeIds) {
            const note = notesMap[noteTreeId];

            note.title = note.note_title;

            if (note.is_protected) {
                note.extraClasses = "protected";
            }

            note.key = counter++ + ""; // key needs to be string
            note.expanded = note.is_expanded;

            noteTreeIdToKey[noteTreeId] = note.key;

            if (parentToChildren[noteTreeId] && parentToChildren[noteTreeId].length > 0) {
                note.folder = true;

                if (note.expanded) {
                    note.children = prepareNoteTreeInner(parentToChildren[noteTreeId], notesMap, parentToChildren);
                }
                else {
                    note.lazy = true;
                }
            }

            noteList.push(note);
        }

        return noteList;
    }

    async function activateNode(notePath) {
        const path = notePath.split("/").reverse();

        if (!notesMap[path[0]]) {
            console.log("Requested note doesn't exist.");
            return;
        }

        const effectivePath = [];

        for (const noteTreeId of path) {
            effectivePath.push(noteTreeId);
        }

        const runPath = effectivePath.reverse();

        for (let i = 0; i < runPath.length; i++) {
            const noteTreeId = runPath[i];

            const node = treeUtils.getNodeByNoteTreeId(noteTreeId);

            if (i < runPath.length - 1) {
                await node.setExpanded();
            }
            else {
                await node.setActive();
            }
        }
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

    function initFancyTree(noteTree) {
        const keybindings = {
            "insert": node => {
                const parentNoteTreeId = treeUtils.getParentNoteTreeId(node);
                const isProtected = treeUtils.getParentProtectedStatus(node);

                noteEditor.createNote(node, parentNoteTreeId, 'after', isProtected);
            },
            "ctrl+insert": node => {
                noteEditor.createNote(node, node.note_id, 'into', node.data.is_protected);
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
            "return": node => {
                // doesn't work :-/
                noteDetailEl.summernote('focus');
            }
        };

        treeEl.fancytree({
            autoScroll: true,
            extensions: ["hotkeys", "filter", "dnd"],
            source: noteTree,
            scrollParent: $("#tree"),
            activate: (event, data) => {
                const node = data.node.data;

                document.location.hash = treeUtils.getNotePath(data.node);

                recentNotes.addRecentNote(node.note_tree_id);

                noteEditor.switchToNote(node.note_id);
            },
            expand: (event, data) => {
                setExpandedToServer(getNoteTreeIdFromKey(data.node.key), true);
            },
            collapse: (event, data) => {
                setExpandedToServer(getNoteTreeIdFromKey(data.node.key), false);
            },
            init: (event, data) => {
                if (startNoteTreeId) {
                    activateNode(startNoteTreeId);
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
                const noteTreeId = node.note_tree_id;

                if (parentToChildren[noteTreeId]) {
                    data.result = prepareNoteTreeInner(parentToChildren[noteTreeId]);
                }
                else {
                    console.log("No children for " + noteTreeId + ". This shouldn't happen.");
                }
            }
        });

        treeEl.contextmenu(contextMenu.contextMenuSettings);
    }

    async function reload() {
        const notes = await loadTree();

        // this will also reload the note content
        await treeEl.fancytree('getTree').reload(notes);
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
        const node = treeUtils.getNodeByNoteTreeId(noteEditor.getCurrentNoteId());

        if (node) {
            node.makeVisible({scrollIntoView: true});

            node.setFocus();
        }
    }

    function showSearch() {
        $("#search-box").show();

        $("input[name=search]").focus();
    }

    function toggleSearch() {
        if ($("#search-box:hidden").length) {
            showSearch();
        }
        else {
            resetSearch();

            $("#search-box").hide();
        }
    }

    function resetSearch() {
        $("input[name=search]").val("");

        const tree = treeEl.fancytree("getTree");
        tree.clearFilter();
    }

    function getByNoteId(noteId) {
        return notesMap[noteId];
    }

    // note that if you want to access data like note_id or is_protected, you need to go into "data" property
    function getCurrentNode() {
        return treeEl.fancytree("getActiveNode");
    }

    function getCurrentNoteTreeId() {
        const node = getCurrentNode();
        return node.data.note_tree_id;
    }

    function setCurrentNoteTreeBasedOnProtectedStatus() {
        const node = getCurrentNode();

        node.toggleClass("protected", !!node.data.is_protected);
    }

    $("button#reset-search-button").click(resetSearch);

    $("input[name=search]").keyup(e => {
        const searchString = $("input[name=search]").val();

        if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchString) === "") {
            $("button#reset-search-button").click();
            return;
        }

        if (e && e.which === $.ui.keyCode.ENTER) {
            $.get(baseApiUrl + 'notes?search=' + searchString).then(resp => {
                console.log("search: ", resp);

                // Pass a string to perform case insensitive matching
                const tree = treeEl.fancytree("getTree");
                tree.filterBranches(node => {
                    return resp.includes(node.data.note_id);
                });
            });
        }
    }).focus();

    $(document).bind('keydown', 'alt+s', showSearch);

    return {
        getTreeLoadTime,
        getClipboardNoteTreeId,
        setClipboardNoteTreeId,
        reload,
        collapseTree,
        scrollToCurrentNote,
        toggleSearch,
        getByNoteId,
        getKeyFromNoteTreeId,
        getNoteTreeIdFromKey,
        setCurrentNoteTreeBasedOnProtectedStatus,
        getCurrentNode,
        getCurrentNoteTreeId,
        activateNode
    };
})();