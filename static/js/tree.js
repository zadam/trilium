function moveBeforeNode(node, beforeNode) {
    $.ajax({
        url: baseUrl + 'notes/' + node.key + '/moveBefore/' + beforeNode.key,
        type: 'PUT',
        contentType: "application/json",
        success: function () {
            node.moveTo(beforeNode, 'before');
        }
    });
}

function moveAfterNode(node, afterNode) {
    $.ajax({
        url: baseUrl + 'notes/' + node.key + '/moveAfter/' + afterNode.key,
        type: 'PUT',
        contentType: "application/json",
        success: function () {
            node.moveTo(afterNode, 'after');
        }
    });
}

function moveToNode(node, toNode) {
    $.ajax({
        url: baseUrl + 'notes/' + node.key + '/moveTo/' + toNode.key,
        type: 'PUT',
        contentType: "application/json",
        success: function (result) {
            node.moveTo(toNode);

            toNode.setExpanded(true);

            toNode.folder = true;
            toNode.renderTitle();
        }
    });
}

function deleteNode(node) {
    if (confirm('Are you sure you want to delete note "' + node.title + '"?')) {
        $.ajax({
            url: baseUrl + 'notes/' + node.key,
            type: 'DELETE',
            success: function () {
                if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                    node.getParent().folder = false;
                    node.getParent().renderTitle();
                }

                globalAllNoteIds = globalAllNoteIds.filter(e => e !== node.key);

                // remove from recent notes
                globalRecentNotes = globalRecentNotes.filter(note => note !== node.key);

                let next = node.getNextSibling();
                if (!next) {
                    next = node.getParent();
                }

                node.remove();

                // activate next element after this one is deleted so we don't lose focus
                next.setActive();
            }
        });
    }
}

function getParentKey(node) {
    return (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;
}

const keybindings = {
    "insert": function(node) {
        const parentKey = getParentKey(node);

        createNote(node, parentKey, 'after');
    },
    "ctrl+insert": function(node) {
        createNote(node, node.key, 'into');
    },
    "del": function(node) {
        deleteNode(node);
    },
    "shift+up": function(node) {
        const beforeNode = node.getPrevSibling();

        if (beforeNode !== null) {
            moveBeforeNode(node, beforeNode);
        }
    },
    "shift+down": function(node) {
        let afterNode = node.getNextSibling();
        if (afterNode !== null) {
            moveAfterNode(node, afterNode);
        }
    },
    "shift+left": function(node) {
        if (node.getParent() !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveAfter/' + node.getParent().key,
                type: 'PUT',
                contentType: "application/json",
                success: function() {
                    if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                        node.getParent().folder = false;
                        node.getParent().renderTitle();
                    }

                    node.moveTo(node.getParent(), 'after');
                }
            });
        }
    },
    "shift+right": function(node) {
        let toNode = node.getPrevSibling();

        if (toNode !== null) {
            moveToNode(node, toNode);
        }
    },
    "return": function(node) {
        // doesn't work :-/
        $('#noteDetail').summernote('focus');
    }
};

let globalAllNoteIds = [];

let globalTree;

function getNodeByKey(noteId) {
    return globalTree.fancytree('getNodeByKey', noteId);
}

function getFullName(noteId) {
    let note = getNodeByKey(noteId);
    const path = [];

    while (note) {
        path.push(note.title);

        note = note.getParent();
    }

    // remove "root" element
    path.pop();

    return path.reverse().join(" > ");
}

let globalClipboardNoteId = null;

$(function(){
    $.get(baseUrl + 'tree').then(resp => {
        const notes = resp.notes;
        let startNoteId = resp.start_note_id;

        if (document.location.hash) {
            startNoteId = document.location.hash.substr(1); // strip initial #
        }

        function copyTitle(notes) {
            for (const note of notes) {
                globalAllNoteIds.push(note.note_id);

                note.title = note.note_title;

                if (note.is_clone) {
                    note.title += " (clone)";
                }

                note.key = note.note_id;
                note.expanded = note.is_expanded;

                if (note.children && note.children.length > 0) {
                    copyTitle(note.children);
                }
            }
        }

        copyTitle(notes);

        function setExpanded(note_id, is_expanded) {
            expanded_num = is_expanded ? 1 : 0;

            $.ajax({
                url: baseUrl + 'notes/' + note_id + '/expanded/' + expanded_num,
                type: 'PUT',
                contentType: "application/json",
                success: function(result) {}
            });
        }

        globalTree = $("#tree");
        globalTree.fancytree({
            autoScroll: true,
            extensions: ["hotkeys", "filter", "dnd"],
            source: notes,
            activate: function(event, data){
                const node = data.node.data;

                saveNoteIfChanged(() => loadNote(node.note_id));
            },
            expand: function(event, data) {
                setExpanded(data.node.key, true);
            },
            collapse: function(event, data) {
                setExpanded(data.node.key, false);
            },
            init: function(event, data) {
                if (startNoteId) {
                    data.tree.activateKey(startNoteId);
                }

                $(window).resize();
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
            dnd: {
                autoExpandMS: 600,
                draggable: { // modify default jQuery draggable options
                    zIndex: 1000,
                    scroll: false,
                    containment: "parent",
                    revert: "invalid"
                },
                preventRecursiveMoves: true, // Prevent dropping nodes on own descendants
                preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.

                dragStart: function(node, data) {
                    // This function MUST be defined to enable dragging for the tree.
                    // Return false to cancel dragging of node.
                    return true;
                },
                dragEnter: function(node, data) {
                    /* data.otherNode may be null for non-fancytree droppables.
                    * Return false to disallow dropping on node. In this case
                    * dragOver and dragLeave are not called.
                    * Return 'over', 'before, or 'after' to force a hitMode.
                    * Return ['before', 'after'] to restrict available hitModes.
                    * Any other return value will calc the hitMode from the cursor position.
                    */
                    // Prevent dropping a parent below another parent (only sort
                    // nodes under the same parent):
                    //    if(node.parent !== data.otherNode.parent){
                    //      return false;
                    //    }
                    // Don't allow dropping *over* a node (would create a child). Just
                    // allow changing the order:
                    //    return ["before", "after"];
                    // Accept everything:
                    return true;
                },
                dragExpand: function(node, data) {
                  // return false to prevent auto-expanding data.node on hover
                },
                dragOver: function(node, data) {
                },
                dragLeave: function(node, data) {
                },
                dragStop: function(node, data) {
                },
                dragDrop: function(node, data) {
                    // This function MUST be defined to enable dropping of items on the tree.
                    // data.hitMode is 'before', 'after', or 'over'.

                    if (data.hitMode === "before") {
                        moveBeforeNode(data.otherNode, node);
                    }
                    else if (data.hitMode === "after") {
                        moveAfterNode(data.otherNode, node);
                    }
                    else if (data.hitMode === "over") {
                        moveToNode(data.otherNode, node);
                    }
                    else {
                        throw new Exception("Unknown hitMode=" + data.hitMode);
                    }
                }
            }
        });

        globalTree.contextmenu({
            delegate: "span.fancytree-title",
            autoFocus: true,
            menu: [
                {title: "Insert note here", cmd: "insertNoteHere", uiIcon: "ui-icon-pencil"},
                {title: "Insert child note", cmd: "insertChildNote", uiIcon: "ui-icon-pencil"},
                {title: "Delete", cmd: "delete", uiIcon: "ui-icon-trash"},
                {title: "----"},
                {title: "Cut", cmd: "cut", uiIcon: "ui-icon-scissors"},
                {title: "Copy / clone", cmd: "copy", uiIcon: "ui-icon-copy"},
                {title: "Paste after", cmd: "pasteAfter", uiIcon: "ui-icon-clipboard"},
                {title: "Paste into", cmd: "pasteInto", uiIcon: "ui-icon-clipboard"}
            ],
            beforeOpen: function (event, ui) {
                const node = $.ui.fancytree.getNode(ui.target);
                // Modify menu entries depending on node status
                globalTree.contextmenu("enableEntry", "pasteAfter", globalClipboardNoteId !== null);
                globalTree.contextmenu("enableEntry", "pasteInto", globalClipboardNoteId !== null);

                // Activate node on right-click
                node.setActive();
                // Disable tree keyboard handling
                ui.menu.prevKeyboard = node.tree.options.keyboard;
                node.tree.options.keyboard = false;
            },
            close: function (event, ui) {},
            select: function (event, ui) {
                const node = $.ui.fancytree.getNode(ui.target);

                if (ui.cmd === "insertNoteHere") {
                   const parentKey = getParentKey(node);

                    createNote(node, parentKey, 'after');
                }
                else if (ui.cmd === "insertChildNote") {
                    createNote(node, node.key, 'into');
                }
                else if (ui.cmd === "cut") {
                    globalClipboardNoteId = node.key;
                }
                else if (ui.cmd === "pasteAfter") {
                    const subjectNode = getNodeByKey(globalClipboardNoteId);

                    moveAfterNode(subjectNode, node);

                    globalClipboardNoteId = null;
                }
                else if (ui.cmd === "pasteInto") {
                    const subjectNode = getNodeByKey(globalClipboardNoteId);

                    moveToNode(subjectNode, node);

                    globalClipboardNoteId = null;
                }
                else if (ui.cmd === "delete") {
                    deleteNode(node);
                }
                else {
                    console.log("Unknown command: " + ui.cmd);
                }
            }
        });
    });
});

$("input[name=search]").keyup(function (e) {
    const searchString = $(this).val();

    if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchString) === "") {
        $("button#btnResetSearch").click();
        return;
    }

    if (e && e.which === $.ui.keyCode.ENTER) {
        $.get(baseUrl + 'notes?search=' + searchString).then(resp => {
            console.log("search: ", resp);

            // Pass a string to perform case insensitive matching
            const tree = $("#tree").fancytree("getTree");
            tree.filterBranches(function(node) {
                return resp.includes(node.data.note_id);
            });
        });
    }
}).focus();

$("button#btnResetSearch").click(function () {
    $("input[name=search]").val("");

    const tree = $("#tree").fancytree("getTree");
    tree.clearFilter();
});

function collapseTree() {
    $("#tree").fancytree("getRootNode").visit(function(node){
        node.setExpanded(false);
    });
}

$(document).bind('keydown', 'alt+c', collapseTree);