const keybindings = {
    "insert": function(node) {
        let parentKey = (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;

        createNote(node, parentKey, 'after');
    },
    "ctrl+insert": function(node) {
        createNote(node, node.key, 'into');
    },
    "del": function(node) {
        if (confirm('Are you sure you want to delete note "' + node.title + '"?')) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key,
                type: 'DELETE',
                success: function() {
                    if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                        node.getParent().folder = false;
                        node.getParent().renderTitle();
                    }

                    node.remove();
                }
            });
        }
    },
    "shift+up": function(node) {
        if (node.getPrevSibling() !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveBefore/' + node.getPrevSibling().key,
                type: 'PUT',
                contentType: "application/json",
                success: function() {
                    node.moveTo(node.getPrevSibling(), 'before');
                }
            });
        }
    },
    "shift+down": function(node) {
        if (node.getNextSibling() !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveAfter/' + node.getNextSibling().key,
                type: 'PUT',
                contentType: "application/json",
                success: function() {
                    node.moveTo(node.getNextSibling(), 'after');
                }
            });
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
        let prevSibling = node.getPrevSibling();

        if (prevSibling !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveTo/' + prevSibling.key,
                type: 'PUT',
                contentType: "application/json",
                success: function(result) {
                    node.moveTo(prevSibling);

                    prevSibling.setExpanded(true);

                    prevSibling.folder = true;
                    prevSibling.renderTitle();
                }
            });
        }
    },
    "return": function(node) {
        // doesn't work :-/
        $('#noteDetail').summernote('focus');
    }
};


$(function(){
    $.get(baseUrl + 'tree').then(resp => {
        const notes = resp.notes;
        let startNoteId = resp.start_note_id;

        if (document.location.hash) {
            startNoteId = document.location.hash.substr(1); // strip initial #
        }

        function copyTitle(notes) {
            for (let note of notes) {
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

        $("#tree").fancytree({
            autoScroll: true,
            extensions: ["hotkeys"],
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
            },
            hotkeys: {
                keydown: keybindings
            }
        });
    });
});