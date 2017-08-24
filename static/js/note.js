let tags = {
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

function saveNoteIfChanged(callback) {
    if (!isNoteChanged) {
        if (callback) {
            callback();
        }

        return;
    }

    let note = globalNote;

    let contents = $('#noteDetail').summernote('code');

    html2notecase(contents, note);

    let title = $('#noteTitle').val();

    $("#tree").fancytree('getNodeByKey', note.detail.note_id).setTitle(title);

    note.detail.note_title = title;

    $.ajax({
        url: baseUrl + 'notes/' + note.detail.note_id,
        type: 'PUT',
        data: JSON.stringify(note),
        contentType: "application/json",
        success: function() {
            isNoteChanged = false;

            message("Saved!");

            if (callback) {
                callback();
            }
        },
        error: function() {
            error("Error saving the note!");
        }
    });
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
});
  
var globalNote;

function setParent(noteId, newParentKey, successCallback) {
    let newNoteName = "new note";

    $.ajax({
        url: baseUrl + 'notes/' + nodeId + '/setParent/' + newParentKey,
        type: 'PUT',
        contentType: "application/json",
        success: function(result) {
            successCallback();
        }
    });
}

function createNewTopLevelNote() {
    let rootNode = $("#tree").fancytree("getRootNode");

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

recentNotes = [];

function loadNote(noteId) {
    $.get(baseUrl + 'notes/' + noteId).then(function(note) {
        globalNote = note;

        $("#noteTitle").val(note.detail.note_title);

        if (newNoteCreated) {
            newNoteCreated = false;

            $("#noteTitle").focus().select();
        }

        let noteText = notecase2html(note);

        noteChangeDisabled = true;

        $('#noteDetail').summernote('code', noteText);

        document.location.hash = noteId;

        $(window).resize(); // to trigger resizing of editor

        addRecentNote(noteId, note.detail.note_title);

        noteChangeDisabled = false;
    });
}

function addRecentNote(noteId, noteTitle) {
    const origDate = new Date();

    setTimeout(function() {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (noteId === globalNote.detail.note_id) {
            // if it's already there, remove the note
            recentNotes = recentNotes.filter(note => note.noteId !== noteId);

            console.log("added after " + (new Date().getTime() - origDate.getTime()));

            recentNotes.unshift({
                noteId: noteId,
                noteTitle: noteTitle
            });
        }
    }, 1500);
}

function encryptNote() {
    let password = prompt("Enter password for encryption");

    console.log(password);

    // 12 takes about 400 ms on my computer to compute
    let salt = dcodeIO.bcrypt.genSaltSync(12);

    let hashedPassword = dcodeIO.bcrypt.hashSync(password, salt);

    let hashedPasswordSha = sha256(hashedPassword).substr(0, 32);

    console.log(hashedPassword);

    let note = globalNote;

    let contents = $('#noteDetail').summernote('code');

    html2notecase(contents, note);

    let noteJson = JSON.stringify(note);

    console.log('json: ' + noteJson);

    let hashedPasswordBytes = aesjs.utils.hex.toBytes(hashedPasswordSha);

    let noteBytes = aesjs.utils.utf8.toBytes(noteJson);

    let aesCtr = new aesjs.ModeOfOperation.ctr(hashedPasswordBytes, new aesjs.Counter(5));
    let encryptedBytes = aesCtr.encrypt(noteBytes);

    // To print or store the binary data, you may convert it to hex
    let encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);

    console.log("encrypted: " + encryptedBytes);
}