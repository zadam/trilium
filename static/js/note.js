const tags = {
    1: "<b>",
    2: "</b>",
    3: "<i>",
    4: "</i>",
    5: "<u>",
    6: "</u>",
    9: "<s>",
    10: "</s>"
};

let noteChangeDisabled = false;

let isNoteChanged = false;

function noteChanged() {
    if (noteChangeDisabled) {
        return;
    }

    isNoteChanged = true;
}

function updateNoteFromInputs(note) {
    let contents = $('#noteDetail').summernote('code');

    html2notecase(contents, note);

    let title = $('#noteTitle').val();

    getNodeByKey(note.detail.note_id).setTitle(title);

    note.detail.note_title = title;
}

function saveNoteToServer(note, callback) {
    $.ajax({
        url: baseUrl + 'notes/' + note.detail.note_id,
        type: 'PUT',
        data: JSON.stringify(note),
        contentType: "application/json",
        success: function () {
            isNoteChanged = false;

            message("Saved!");

            if (callback) {
                callback();
            }
        },
        error: function () {
            error("Error saving the note!");
        }
    });
}

function saveNoteIfChanged(callback) {
    if (!isNoteChanged) {
        if (callback) {
            callback();
        }

        return;
    }

    const note = globalNote;

    updateNoteFromInputs(note);

    encryptNoteIfNecessary(note);

    saveNoteToServer(note, callback);
}

setInterval(saveNoteIfChanged, 5000);

$(document).ready(function() {
    $("#noteTitle").on('input', function() {
        noteChanged();
    });

    $('#noteDetail').summernote({
        airMode: true,
        height: 300,
        callbacks: {
            onChange: noteChanged
        }
    });

    // so that tab jumps from note title (which has tabindex 1)
    $(".note-editable").attr("tabindex", 2);
});
  
let globalNote;

function createNewTopLevelNote() {
    let rootNode = globalTree.fancytree("getRootNode");

    createNote(rootNode, "root", "into");
}

let newNoteCreated = false;

function createNote(node, parentKey, target) {
    let newNoteName = "new note";

    $.ajax({
        url: baseUrl + 'notes/' + parentKey + '/children' ,
        type: 'POST',
        data: JSON.stringify({
            note_title: newNoteName,
            target: target,
            target_note_id: node.key
        }),
        contentType: "application/json",
        success: function(result) {
            let newNode = {
                "title": newNoteName,
                "key": result.note_id,
                "note_id": result.note_id
            };

            globalAllNoteIds.push(result.note_id);

            newNoteCreated = true;

            if (target === 'after') {
                node.appendSibling(newNode).setActive(true);
            }
            else {
                node.addChildren(newNode).setActive(true);

                node.folder = true;
                node.renderTitle();
            }

            message("Created!");
        }
    });
}

globalRecentNotes = [];

function setNoteBackgroundIfEncrypted(note) {
    if (note.detail.encryption > 0) {
        $(".note-editable").addClass("encrypted");
        $("#encryptButton").hide();
        $("#decryptButton").show();
    }
    else {
        $(".note-editable").removeClass("encrypted");
        $("#encryptButton").show();
        $("#decryptButton").hide();
    }
}

function loadNote(noteId) {
    $.get(baseUrl + 'notes/' + noteId).then(function(note) {
        globalNote = note;

        $("#noteTitle").val(note.detail.note_title);

        if (newNoteCreated) {
            newNoteCreated = false;

            $("#noteTitle").focus().select();
        }

        handleEncryption(note.detail.encryption > 0, false, () => {
            $("#noteDetailWrapper").show();

            // this may fal if the dialog has not been previously opened
            try {
                $("#encryptionPasswordDialog").dialog('close');
            }
            catch(e) {}

            $("#encryptionPassword").val('');

            note.detail.note_text = decryptNoteIfNecessary(note);

            let noteText = notecase2html(note);

            noteChangeDisabled = true;

            // Clear contents and remove all stored history. This is to prevent undo from going across notes
            $('#noteDetail').summernote('reset');

            $('#noteDetail').summernote('code', noteText);

            document.location.hash = noteId;

            $(window).resize(); // to trigger resizing of editor

            addRecentNote(noteId, note.detail.note_id);

            noteChangeDisabled = false;

            setNoteBackgroundIfEncrypted(note);
        });
    });
}

function addRecentNote(noteTreeId, noteContentId) {
    const origDate = new Date();

    setTimeout(function() {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (noteTreeId === globalNote.detail.note_id || noteContentId === globalNote.detail.note_id) {
            // if it's already there, remove the note
            globalRecentNotes = globalRecentNotes.filter(note => note !== noteTreeId);

            globalRecentNotes.unshift(noteTreeId);
        }
    }, 1500);
}

