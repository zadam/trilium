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
  
var globalNote;

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

let globalEncryptionCallback = null;

function handleEncryption(requireEncryption, modal, callback) {
    if (requireEncryption && globalEncryptionKey === null) {
        globalEncryptionCallback = callback;

        if (!modal) {
            $("#noteDetailWrapper").hide();
        }

        $("#encryptionPasswordDialog").dialog({
            modal: modal,
            width: 400,
            open: function() {
                if (!modal) {
                    // dialog steals focus for itself, which is not what we want for non-modal (viewing)
                    getNodeByKey(globalNote.detail.note_id).setFocus();
                }
            }
        });
    }
    else {
        callback();
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

function deriveEncryptionKey(password) {
    // why this is done is explained here: https://github.com/ricmoo/scrypt-js - "Encoding notes"
    const normalizedPassword = password.normalize('NFKC');
    const salt = "dc73b57736511340f132e4b5521d178afa6311c45e0c25e6a9339038507852a6";

    const passwordBuffer = new buffer.SlowBuffer(normalizedPassword);
    const saltBuffer = new buffer.SlowBuffer(salt);

    // this settings take ~500ms on my laptop
    const N = 16384, r = 16, p = 1;
    // 32 byte key - AES 256
    const dkLen = 32;

    const startedDate = new Date();

    return new Promise((resolve, reject) => {
        scrypt(passwordBuffer, saltBuffer, N, r, p, dkLen, function (error, progress, key) {
            if (error) {
                console.log("Error: " + error);

                reject();
            }
            else if (key) {
                console.log("Computation took " + (new Date().getTime() - startedDate.getTime()) + "ms");

                $.ajax({
                    url: baseUrl + 'password/verify',
                    type: 'POST',
                    data: JSON.stringify({
                        password: sha256(key)
                    }),
                    contentType: "application/json",
                    success: function (result) {
                        if (result.valid) {
                            resolve(key);
                        }
                        else {
                            alert("Wrong password");

                            reject();
                        }
                    }
                });
            }
            else {
                // update UI with progress complete
            }
        });
    });
}

let globalEncryptionKey = null;

$("#encryptionPasswordForm").submit(function() {
    const password = $("#encryptionPassword").val();
    $("#encryptionPassword").val("");

    deriveEncryptionKey(password).then(key => {
        $("#noteDetailWrapper").show();
        $("#encryptionPasswordDialog").dialog("close");

        globalEncryptionKey = key;

        if (globalEncryptionCallback !== null) {
            globalEncryptionCallback();

            globalEncryptionCallback = null;
        }
    });

    return false;
});

function getAes() {
    return new aesjs.ModeOfOperation.ctr(globalEncryptionKey, new aesjs.Counter(5));
}

function encryptNoteIfNecessary(note) {
    if (note.detail.encryption === 0) {
        return note;
    }
    else {
        return encryptNote(note);
    }
}

function encryptNote(note) {
    const aes = getAes();
    const noteJson = note.detail.note_text;

    const noteBytes = aesjs.utils.utf8.toBytes(noteJson);

    const encryptedBytes = aes.encrypt(noteBytes);

    // To print or store the binary data, you may convert it to hex
    note.detail.note_text = uint8ToBase64(encryptedBytes);

    return note;
}

function encryptNoteAndSendToServer() {
    handleEncryption(true, true, () => {
        const note = globalNote;

        updateNoteFromInputs(note);

        encryptNote(note);

        note.detail.encryption = 1;

        saveNoteToServer(note);

        setNoteBackgroundIfEncrypted(note);
    });
}

function decryptNoteAndSendToServer() {
    handleEncryption(true, true, () => {
        const note = globalNote;

        updateNoteFromInputs(note);

        note.detail.encryption = 0;

        saveNoteToServer(note);

        setNoteBackgroundIfEncrypted(note);
    });
}

function decryptNoteIfNecessary(note) {
    if (note.detail.encryption === 1) {
        return decryptNote(note.detail.note_text);
    }
    else {
        return note.detail.note_text;
    }
}

function decryptNote(encryptedBase64) {
    const aes = getAes();
    const encryptedBytes = base64ToUint8Array(encryptedBase64);

    const decryptedBytes = aes.decrypt(encryptedBytes);

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

function uint8ToBase64(u8Arr) {
    const CHUNK_SIZE = 0x8000; //arbitrary number
    const length = u8Arr.length;
    let index = 0;
    let result = '';
    let slice;
    while (index < length) {
        slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
}

function base64ToUint8Array(base64encoded) {
    return new Uint8Array(atob(base64encoded).split("").map(function(c) { return c.charCodeAt(0); }));
}