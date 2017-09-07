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

// currently not configurable
const globalEncryptionKeyTimeToLive = 10 * 60 * 1000; // in milliseconds

let globalEncryptionKey = null;
let globalLastEncryptionOperationDate = null;

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
    globalLastEncryptionOperationDate = new Date();

    setTimeout(function() {
        if (new Date().getTime() - globalLastEncryptionOperationDate.getTime() > globalEncryptionKeyTimeToLive) {
            globalEncryptionKey = null;

            if (globalNote.detail.encryption > 0) {
                loadNote(globalNote.detail.note_id);
            }
        }
    }, globalEncryptionKeyTimeToLive + 1000);

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