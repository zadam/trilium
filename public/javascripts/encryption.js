"use strict";

const encryption = (function() {
    const dialogEl = $("#encryption-password-dialog");
    const encryptionPasswordFormEl = $("#encryption-password-form");
    const encryptionPasswordEl = $("#encryption-password");

    let encryptionDeferred = null;
    let dataKey = null;
    let lastEncryptionOperationDate = null;
    let passwordDerivedKeySalt = null;
    let encryptedDataKey = null;
    let encryptionSessionTimeout = null;

    $.ajax({
        url: baseApiUrl + 'settings/all',
        type: 'GET',
        error: () => showError("Error getting encryption settings.")
    }).then(settings => {
        passwordDerivedKeySalt = settings.password_derived_key_salt;
        encryptionSessionTimeout = settings.encryption_session_timeout;
        encryptedDataKey = settings.encrypted_data_key;
    });

    function setEncryptedDataKey(encDataKey) {
        encryptedDataKey = encDataKey;
    }

    function setEncryptionSessionTimeout(encSessTimeout) {
        encryptionSessionTimeout = encSessTimeout;
    }

    function ensureEncryptionIsAvailable(requireEncryption, modal) {
        const dfd = $.Deferred();

        if (requireEncryption && dataKey === null) {
            // if this is entry point then we need to show the app even before the note is loaded
            showAppIfHidden();

            encryptionDeferred = dfd;

            dialogEl.dialog({
                modal: modal,
                width: 400,
                open: () => {
                    if (!modal) {
                        // dialog steals focus for itself, which is not what we want for non-modal (viewing)
                        treeUtils.getNodeByKey(noteEditor.getCurrentNoteId()).setFocus();
                    }
                }
            });
        }
        else {
            dfd.resolve();
        }

        return dfd.promise();
    }

    async function getDataKey(password) {
        const passwordDerivedKey = await computeScrypt(password, passwordDerivedKeySalt);

        const dataKeyAes = getDataKeyAes(passwordDerivedKey);

        return decrypt(dataKeyAes, encryptedDataKey);
    }

    function computeScrypt(password, salt) {
        const normalizedPassword = password.normalize('NFKC');
        const passwordBuffer = new buffer.SlowBuffer(normalizedPassword);
        const saltBuffer = new buffer.SlowBuffer(salt);

        // this settings take ~500ms on my laptop
        const N = 16384, r = 8, p = 1;
        // 32 byte key - AES 256
        const dkLen = 32;

        return new Promise((resolve, reject) => {
            scrypt(passwordBuffer, saltBuffer, N, r, p, dkLen, (error, progress, key) => {
                if (error) {
                    showError(error);

                    reject(error);
                }
                else if (key) {
                    resolve(key);
                }
            });
        });
    }

    function decryptTreeItems() {
        if (!isEncryptionAvailable()) {
            return;
        }

        for (const noteId of glob.allNoteIds) {
            const note = treeUtils.getNodeByKey(noteId);

            if (note.data.encryption > 0) {
                const title = decryptString(note.data.note_title);

                note.setTitle(title);
            }
        }
    }

    async function setupEncryptionSession() {
        const password = encryptionPasswordEl.val();
        encryptionPasswordEl.val("");

        const key = await getDataKey(password);
        if (key === false) {
            showError("Wrong password!");
            return;
        }

        dialogEl.dialog("close");

        dataKey = key;

        decryptTreeItems();

        if (encryptionDeferred !== null) {
            encryptionDeferred.resolve();

            encryptionDeferred = null;
        }
    }

    function resetEncryptionSession() {
        dataKey = null;

        // most secure solution - guarantees nothing remained in memory
        // since this expires because user doesn't use the app, it shouldn't be disruptive
        window.location.reload(true);
    }

    function isEncryptionAvailable() {
        return dataKey !== null;
    }

    function getDataAes() {
        lastEncryptionOperationDate = new Date();

        return new aesjs.ModeOfOperation.ctr(dataKey, new aesjs.Counter(5));
    }

    function getDataKeyAes(passwordDerivedKey) {
        return new aesjs.ModeOfOperation.ctr(passwordDerivedKey, new aesjs.Counter(5));
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
        return encrypt(getDataAes(), str);
    }

    function encrypt(aes, str) {
        const payload = Array.from(aesjs.utils.utf8.toBytes(str));
        const digest = sha256Array(payload).slice(0, 4);

        const digestWithPayload = digest.concat(payload);

        const encryptedBytes = aes.encrypt(digestWithPayload);

        return uint8ToBase64(encryptedBytes);
    }

    function decryptString(encryptedBase64) {
        const decryptedBytes = decrypt(getDataAes(), encryptedBase64);

        return aesjs.utils.utf8.fromBytes(decryptedBytes);
    }

    function decrypt(aes, encryptedBase64) {
        const encryptedBytes = base64ToUint8Array(encryptedBase64);

        const decryptedBytes = aes.decrypt(encryptedBytes);

        const digest = decryptedBytes.slice(0, 4);
        const payload = decryptedBytes.slice(4);

        const hashArray = sha256Array(payload);

        const computedDigest = hashArray.slice(0, 4);

        if (!arraysIdentical(digest, computedDigest)) {
            return false;
        }

        return payload;
    }

    function sha256Array(content) {
        const hash = sha256.create();
        hash.update(content);
        return hash.array();
    }

    function arraysIdentical(a, b) {
        let i = a.length;
        if (i !== b.length) return false;
        while (i--) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function encryptNote(note) {
        note.detail.note_title = encryptString(note.detail.note_title);
        note.detail.note_text = encryptString(note.detail.note_text);

        note.detail.encryption = 1;

        return note;
    }

    async function encryptNoteAndSendToServer() {
        await ensureEncryptionIsAvailable(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        encryptNote(note);

        await noteEditor.saveNoteToServer(note);

        await changeEncryptionOnNoteHistory(note.detail.note_id, true);

        noteEditor.setNoteBackgroundIfEncrypted(note);
    }

    async function changeEncryptionOnNoteHistory(noteId, encrypt) {
        const result = await $.ajax({
            url: baseApiUrl + 'notes-history/' + noteId + "?encryption=" + (encrypt ? 0 : 1),
            type: 'GET',
            error: () => showError("Error getting note history.")
        });

        for (const row of result) {
            if (encrypt) {
                row.note_title = encryptString(row.note_title);
                row.note_text = encryptString(row.note_text);
            }
            else {
                row.note_title = decryptString(row.note_title);
                row.note_text = decryptString(row.note_text);
            }

            row.encryption = encrypt ? 1 : 0;

            await $.ajax({
                url: baseApiUrl + 'notes-history',
                type: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(row),
                error: () => showError("Error de/encrypting note history.")
            });

            console.log('Note history ' + row.note_history_id + ' de/encrypted');
        }
    }

    async function decryptNoteAndSendToServer() {
        await ensureEncryptionIsAvailable(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.encryption = 0;

        await noteEditor.saveNoteToServer(note);

        await changeEncryptionOnNoteHistory(note.detail.note_id, false);

        noteEditor.setNoteBackgroundIfEncrypted(note);
    }

    function decryptNoteIfNecessary(note) {
        if (note.detail.encryption > 0) {
            decryptNote(note);
        }
    }

    function decryptNote(note) {
        note.detail.note_title = decryptString(note.detail.note_title);
        note.detail.note_text = decryptString(note.detail.note_text);
    }

    async function encryptSubTree(noteId) {
        await ensureEncryptionIsAvailable(true, true);

        updateSubTreeRecursively(noteId, note => {
                if (note.detail.encryption === null || note.detail.encryption === 0) {
                    encryptNote(note);

                    note.detail.encryption = 1;

                    return true;
                }
                else {
                    return false;
                }
            },
            note => {
                if (note.detail.note_id === noteEditor.getCurrentNoteId()) {
                    noteEditor.loadNoteToEditor(note.detail.note_id);
                }
                else {
                    noteEditor.setTreeBasedOnEncryption(note);
                }
            });

        showMessage("Encryption finished.");
    }

    async function decryptSubTree(noteId) {
        await ensureEncryptionIsAvailable(true, true);

        updateSubTreeRecursively(noteId, note => {
                if (note.detail.encryption === 1) {
                    decryptNote(note);

                    note.detail.encryption = 0;

                    return true;
                }
                else {
                    return false;
                }
            },
            note => {
                if (note.detail.note_id === noteEditor.getCurrentNoteId()) {
                    noteEditor.loadNoteToEditor(note.detail.note_id);
                }
                else {
                    noteEditor.setTreeBasedOnEncryption(note);
                }
            });

        showMessage("Decryption finished.");
    }

    function updateSubTreeRecursively(noteId, updateCallback, successCallback) {
        updateNoteSynchronously(noteId, updateCallback, successCallback);

        const node = treeUtils.getNodeByKey(noteId);
        if (!node || !node.getChildren()) {
            return;
        }

        for (const child of node.getChildren()) {
            updateSubTreeRecursively(child.key, updateCallback, successCallback);
        }
    }

    function updateNoteSynchronously(noteId, updateCallback, successCallback) {
        $.ajax({
            url: baseApiUrl + 'notes/' + noteId,
            type: 'GET',
            async: false,
            success: note => {
                const needSave = updateCallback(note);

                if (!needSave) {
                    return;
                }

                for (const link of note.links) {
                    delete link.type;
                }

                $.ajax({
                    url: baseApiUrl + 'notes/' + noteId,
                    type: 'PUT',
                    data: JSON.stringify(note),
                    contentType: "application/json",
                    async: false,
                    success: () => {
                        if (successCallback) {
                            successCallback(note);
                        }
                    },
                    error: () => showError("Updating " + noteId + " failed.")

                });
            },
            error: () => showError("Reading " + noteId + " failed.")
        });
    }

    encryptionPasswordFormEl.submit(() => {
        setupEncryptionSession();

        return false;
    });

    setInterval(() => {
        if (lastEncryptionOperationDate !== null && new Date().getTime() - lastEncryptionOperationDate.getTime() > encryptionSessionTimeout * 1000) {
            resetEncryptionSession();
        }
    }, 5000);

    return {
        setEncryptedDataKey,
        setEncryptionSessionTimeout,
        ensureEncryptionIsAvailable,
        decryptTreeItems,
        resetEncryptionSession,
        isEncryptionAvailable,
        encryptNoteIfNecessary,
        encryptString,
        decryptString,
        encryptNoteAndSendToServer,
        decryptNoteAndSendToServer,
        decryptNoteIfNecessary,
        encryptSubTree,
        decryptSubTree
    };
})();