const keybindings = {
    "insert": function(node) {
        const parentKey = getParentKey(node);
        const encryption = getParentEncryption(node);

        createNote(node, parentKey, 'after', encryption);
    },
    "ctrl+insert": function(node) {
        createNote(node, node.key, 'into', node.data.encryption);
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
        moveNodeUp(node);
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

const globalTree = $("#tree");

let globalClipboardNoteId = null;

function prepareNoteTree(notes) {
    for (const note of notes) {
        globalAllNoteIds.push(note.note_id);

        if (note.encryption > 0) {
            note.title = "[encrypted]";

            note.extraClasses = "encrypted";
        }
        else {
            note.title = note.note_title;

            if (note.is_clone) {
                note.title += " (clone)";
            }
        }

        note.key = note.note_id;
        note.expanded = note.is_expanded;

        if (note.children && note.children.length > 0) {
            prepareNoteTree(note.children);
        }
    }
}

function setExpandedToServer(note_id, is_expanded) {
    expanded_num = is_expanded ? 1 : 0;

    $.ajax({
        url: baseUrl + 'notes/' + note_id + '/expanded/' + expanded_num,
        type: 'PUT',
        contentType: "application/json",
        success: function(result) {}
    });
}

let globalVerificationSalt;
let globalEncryptionSalt;
let globalEncryptionSessionTimeout;

$(function(){
    $.get(baseUrl + 'tree').then(resp => {
        const notes = resp.notes;
        let startNoteId = resp.start_note_id;
        globalVerificationSalt = resp.verification_salt;
        globalEncryptionSalt = resp.encryption_salt;
        globalEncryptionSessionTimeout = resp.encryption_session_timeout;

        if (document.location.hash) {
            startNoteId = document.location.hash.substr(1); // strip initial #
        }

        prepareNoteTree(notes);

        globalTree.fancytree({
            autoScroll: true,
            extensions: ["hotkeys", "filter", "dnd"],
            source: notes,
            activate: function(event, data){
                const node = data.node.data;

                saveNoteIfChanged(() => loadNote(node.note_id));
            },
            expand: function(event, data) {
                setExpandedToServer(data.node.key, true);
            },
            collapse: function(event, data) {
                setExpandedToServer(data.node.key, false);
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
            dnd: dragAndDropSetup
        });

        globalTree.contextmenu(contextMenuSetup);
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
            const tree = globalTree.fancytree("getTree");
            tree.filterBranches(function(node) {
                return resp.includes(node.data.note_id);
            });
        });
    }
}).focus();

$("button#btnResetSearch").click(function () {
    $("input[name=search]").val("");

    const tree = globalTree.fancytree("getTree");
    tree.clearFilter();
});

function collapseTree() {
    globalTree.fancytree("getRootNode").visit(function(node){
        node.setExpanded(false);
    });
}

$(document).bind('keydown', 'alt+c', collapseTree);