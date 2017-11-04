const encryption = (function() {
    const dialogEl = $("#encryption-password-dialog");
    const encryptionPasswordFormEl = $("#encryption-password-form");
    const encryptionPasswordEl = $("#encryption-password");

    let encryptionDeferred = null;
    let dataKey = null;
    let lastEncryptionOperationDate = null;
    let encryptionSalt = null;
    let encryptedDataKey = null;
    let encryptionSessionTimeout = null;

    function setEncryptionSalt(encSalt) {
        encryptionSalt = encSalt;
    }

    function setEncryptedDataKey(encDataKey) {
        encryptedDataKey = encDataKey;
    }

    function setEncryptionSessionTimeout(encSessTimeout) {
        encryptionSessionTimeout = encSessTimeout;
    }

    function ensureEncryptionIsAvailable(requireEncryption, modal) {
        const dfd = $.Deferred();

        if (requireEncryption && dataKey === null) {
            encryptionDeferred = dfd;

            dialogEl.dialog({
                modal: modal,
                width: 400,
                open: () => {
                    if (!modal) {
                        // dialog steals focus for itself, which is not what we want for non-modal (viewing)
                        getNodeByKey(noteEditor.getCurrentNoteId()).setFocus();
                    }
                }
            });
        }
        else {
            dfd.resolve();
        }

        return dfd.promise();
    }

    function getDataKey(password) {
        return computeScrypt(password, encryptionSalt, (key, resolve, reject) => {
            const dataKeyAes = getDataKeyAes(key);

            const decryptedDataKey = decrypt(dataKeyAes, encryptedDataKey);

            if (decryptedDataKey === false) {
                reject("Wrong password.");
            }

            resolve(decryptedDataKey);
        });
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
            scrypt(passwordBuffer, saltBuffer, N, r, p, dkLen, (error, progress, key) => {
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

    function decryptTreeItems() {
        if (!isEncryptionAvailable()) {
            return;
        }

        for (const noteId of glob.allNoteIds) {
            const note = getNodeByKey(noteId);

            if (note.data.encryption > 0) {
                const title = decryptString(note.data.note_title);

                note.setTitle(title);
            }
        }
    }

    encryptionPasswordFormEl.submit(() => {
        const password = encryptionPasswordEl.val();
        encryptionPasswordEl.val("");

        getDataKey(password).then(key => {
            dialogEl.dialog("close");

            dataKey = key;

            decryptTreeItems();

            if (encryptionDeferred !== null) {
                encryptionDeferred.resolve();

                encryptionDeferred = null;
            }
        })
            .catch(reason => {
                console.log(reason);

                error(reason);
            });

        return false;
    });

    function resetEncryptionSession() {
        dataKey = null;

        if (noteEditor.getCurrentNote().detail.encryption > 0) {
            noteEditor.loadNoteToEditor(noteEditor.getCurrentNoteId());

            for (const noteId of glob.allNoteIds) {
                const note = getNodeByKey(noteId);

                if (note.data.encryption > 0) {
                    note.setTitle("[encrypted]");
                }
            }
        }
    }

    setInterval(() => {
        if (lastEncryptionOperationDate !== null && new Date().getTime() - lastEncryptionOperationDate.getTime() > encryptionSessionTimeout * 1000) {
            resetEncryptionSession();
        }
    }, 5000);

    function isEncryptionAvailable() {
        return dataKey !== null;
    }

    function getDataAes() {
        lastEncryptionOperationDate = new Date();

        return new aesjs.ModeOfOperation.ctr(dataKey, new aesjs.Counter(5));
    }

    function getDataKeyAes(key) {
        return new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
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
        const payload = aesjs.utils.utf8.toBytes(str);
        const digest = sha256Array(payload).slice(0, 4);

        const digestWithPayload = concat(digest, payload);

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

    function concat(a, b) {
        const result = [];

        for (let key in a) {
            result.push(a[key]);
        }

        for (let key in b) {
            result.push(b[key]);
        }

        return result;
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
            error: () => error("Error getting note history.")
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
                error: () => error("Error de/encrypting note history.")
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

        message("Encryption finished.");
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

        message("Decryption finished.");
    }

    function updateSubTreeRecursively(noteId, updateCallback, successCallback) {
        updateNoteSynchronously(noteId, updateCallback, successCallback);

        const node = getNodeByKey(noteId);
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
                    error: () => {
                        console.log("Updating " + noteId + " failed.");
                    }
                });
            },
            error: () => {
                console.log("Reading " + noteId + " failed.");
            }
        });
    }

    return {
        setEncryptionSalt,
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