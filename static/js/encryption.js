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
                    getNodeByKey(globalCurrentNote.detail.note_id).setFocus();
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
    const verificationSalt = "dc73b57736511340f132e4b5521d178afa6311c45e0c25e6a9339038507852a6";

    const verificationPromise = computeScrypt(password, verificationSalt, (key, resolve, reject) => {
        $.ajax({
            url: baseUrl + 'password/verify',
            type: 'POST',
            data: JSON.stringify({
                password: sha256(key)
            }),
            contentType: "application/json",
            success: function (result) {
                if (result.valid) {
                    resolve();
                }
                else {
                    alert("Wrong password");

                    reject();
                }
            }
        });
    });

    const encryptionKeySalt = "2503bfc386bc028772f803887eaaf4d4a5c1019036873e4ba5de79a4efb7e8d8";

    const encryptionKeyPromise = computeScrypt(password, encryptionKeySalt, (key, resolve, reject) => resolve(key));

    return Promise.all([ verificationPromise, encryptionKeyPromise ]).then(results => results[1]);
}

function computeScrypt(password, salt, callback) {
    const normalizedPassword = password.normalize('NFKC');
    const passwordBuffer = new buffer.SlowBuffer(normalizedPassword);
    const saltBuffer = new buffer.SlowBuffer(salt);

    // this settings take ~500ms on my laptop
    const N = 16384, r = 8, p = 1;
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

                callback(key, resolve, reject);
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

        for (const noteId of globalAllNoteIds) {
            const note = getNodeByKey(noteId);

            if (note.data.encryption > 0) {
                const title = decryptString(note.data.note_title);

                note.setTitle(title);
            }
        }

        if (globalEncryptionCallback !== null) {
            globalEncryptionCallback();

            globalEncryptionCallback = null;
        }
    });

    return false;
});

setInterval(function() {
    if (globalLastEncryptionOperationDate !== null && new Date().getTime() - globalLastEncryptionOperationDate.getTime() > globalEncryptionKeyTimeToLive) {
        globalEncryptionKey = null;

        if (globalCurrentNote.detail.encryption > 0) {
            loadNote(globalCurrentNote.detail.note_id);

            for (const noteId of globalAllNoteIds) {
                const note = getNodeByKey(noteId);

                if (note.data.encryption > 0) {
                    note.setTitle("[encrypted]");
                }
            }
        }
    }
}, 5000);

function isEncryptionAvailable() {
    return globalEncryptionKey !== null;
}

function getAes() {
    globalLastEncryptionOperationDate = new Date();

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

function encryptString(str) {
    const aes = getAes();
    const bytes = aesjs.utils.utf8.toBytes(str);

    const encryptedBytes = aes.encrypt(bytes);

    return uint8ToBase64(encryptedBytes);
}

function decryptString(encryptedBase64) {
    const aes = getAes();
    const encryptedBytes = base64ToUint8Array(encryptedBase64);

    const decryptedBytes = aes.decrypt(encryptedBytes);

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

function encryptNote(note) {
    note.detail.note_title = encryptString(note.detail.note_title);
    note.detail.note_text = encryptString(note.detail.note_text);

    note.detail.encryption = 1;

    return note;
}

function encryptNoteAndSendToServer() {
    handleEncryption(true, true, () => {
        const note = globalCurrentNote;

        updateNoteFromInputs(note);

        encryptNote(note);

        saveNoteToServer(note);

        setNoteBackgroundIfEncrypted(note);
    });
}

function decryptNoteAndSendToServer() {
    handleEncryption(true, true, () => {
        const note = globalCurrentNote;

        updateNoteFromInputs(note);

        note.detail.encryption = 0;

        saveNoteToServer(note);

        setNoteBackgroundIfEncrypted(note);
    });
}

function decryptNoteIfNecessary(note) {
    if (note.detail.encryption > 0) {
        return decryptNote(note);
    }
}

function decryptNote(note) {
    note.detail.note_title = decryptString(note.detail.note_title);
    note.detail.note_text = decryptString(note.detail.note_text);
}