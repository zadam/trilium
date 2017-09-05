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

recentNotes = [];

function loadNote(noteId) {
    $.get(baseUrl + 'notes/' + noteId).then(function(note) {
        globalNote = note;

        $("#noteTitle").val(note.detail.note_title);

        if (newNoteCreated) {
            newNoteCreated = false;

            $("#noteTitle").focus().select();
        }

        let decryptPromise;

        if (note.detail.encryption === 1) {
            decryptPromise = decryptNote(note.detail.note_text);
        }
        else {
            decryptPromise = Promise.resolve(note.detail.note_text);
        }

        decryptPromise.then(decrypted => {
            note.detail.note_text = decrypted;

            let noteText = notecase2html(note);

            noteChangeDisabled = true;

            // Clear contents and remove all stored history. This is to prevent undo from going across notes
            $('#noteDetail').summernote('reset');

            $('#noteDetail').summernote('code', noteText);

            document.location.hash = noteId;

            $(window).resize(); // to trigger resizing of editor

            addRecentNote(noteId, note.detail.note_id);

            noteChangeDisabled = false;
        });
    });
}

function addRecentNote(noteTreeId, noteContentId) {
    const origDate = new Date();

    setTimeout(function() {
        // we include the note into recent list only if the user stayed on the note at least 5 seconds
        if (noteTreeId === globalNote.detail.note_id || noteContentId === globalNote.detail.note_id) {
            // if it's already there, remove the note
            c = recentNotes.filter(note => note !== noteTreeId);

            recentNotes.unshift(noteTreeId);
        }
    }, 1500);
}

function deriveEncryptionKey(password) {
    // why this is done is explained here: https://github.com/ricmoo/scrypt-js - "Encoding notes"
    const normalizedPassword = password.normalize('NFKC');
    // use password as a base for salt (which is itself salted with constant) so that we don't need to store it
    // this means everything is encrypted with the same salt.
    const salt = sha256("Jg&)hZ$" + normalizedPassword + "*P7j.");

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

                resolve(key);
            }
            else {
                // update UI with progress complete
            }
        });
    });
}

let globalEncryptionKeyPromise = null;

function getEncryptionKey() {
    if (globalEncryptionKeyPromise === null) {
        const password = prompt("Enter password for encryption");

        globalEncryptionKeyPromise = deriveEncryptionKey(password);
    }

    return globalEncryptionKeyPromise;
}

function getAes() {
    return getEncryptionKey().then(encryptionKey => {
        return new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(5));
    });
}

function encryptNote() {
    getAes().then(aes => {
       const note = globalNote;

        updateNoteFromInputs(note);

        const noteJson = note.detail.note_text;

        const noteBytes = aesjs.utils.utf8.toBytes(noteJson);

        const encryptedBytes = aes.encrypt(noteBytes);

        // To print or store the binary data, you may convert it to hex
        const encryptedBase64 = uint8ToBase64(encryptedBytes);

        note.detail.note_text = encryptedBase64;
        note.detail.encryption = 1;

        saveNoteToServer(note);
    });
}

function decryptNote(encryptedBase64) {
    return getAes().then(aes => {
        const encryptedBytes = base64ToUint8Array(encryptedBase64);

        const decryptedBytes = aes.decrypt(encryptedBytes);

        return aesjs.utils.utf8.fromBytes(decryptedBytes);
    });
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