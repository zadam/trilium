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
        url: baseApiUrl + 'notes/' + note_id + '/expanded/' + expanded_num,
        type: 'PUT',
        contentType: "application/json",
        success: function(result) {}
    });
}

let globalEncryptionSalt;
let globalEncryptionSessionTimeout;
let globalEncryptedDataKey;
let globalFullLoadTime;

setInterval(() => {
    $.ajax({
        url: baseApiUrl + 'audit/' + globalFullLoadTime,
        type: 'GET',
        success: function (resp) {
            if (resp.changed) {
                window.location.reload(true);
            }
        },
        statusCode: {
            401: function() {
                // if the user got logged out then we should display the page
                // here we do that by reloading which will force the redirect if the user is really logged out
                window.location.reload(true);
            }
        }
    });
}, 10 * 1000);

$(function(){
    $.get(baseApiUrl + 'tree').then(resp => {
        const notes = resp.notes;
        let startNoteId = resp.start_note_id;
        globalEncryptionSalt = resp.password_derived_key_salt;
        globalEncryptionSessionTimeout = resp.encryption_session_timeout;
        globalEncryptedDataKey = resp.encrypted_data_key;
        globalFullLoadTime = resp.full_load_time;

        // add browser ID header to all AJAX requests
        $.ajaxSetup({
            headers: { 'x-browser-id': resp.browser_id }
        });

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

function collapseTree() {
    globalTree.fancytree("getRootNode").visit(function(node){
        node.setExpanded(false);
    });
}

$(document).bind('keydown', 'alt+c', collapseTree);

function scrollToCurrentNote() {
    const node = getNodeByKey(globalCurrentNote.detail.note_id);

    if (node) {
        node.makeVisible({scrollIntoView: true});

        node.setFocus();
    }
}

function showSearch() {
    $("#search-box").show();

    $("input[name=search]").focus();
}

$(document).bind('keydown', 'alt+s', showSearch);

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

    const tree = globalTree.fancytree("getTree");
    tree.clearFilter();
}

$("button#btnResetSearch").click(resetSearch);

$("input[name=search]").keyup(function (e) {
    const searchString = $(this).val();

    if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchString) === "") {
        $("button#btnResetSearch").click();
        return;
    }

    if (e && e.which === $.ui.keyCode.ENTER) {
        $.get(baseApiUrl + 'notes?search=' + searchString).then(resp => {
            console.log("search: ", resp);

            // Pass a string to perform case insensitive matching
            const tree = globalTree.fancytree("getTree");
            tree.filterBranches(function(node) {
                return resp.includes(node.data.note_id);
            });
        });
    }
}).focus();