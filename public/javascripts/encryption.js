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
    let protectedSessionId = null;

    $.ajax({
        url: baseApiUrl + 'settings/all',
        type: 'GET',
        error: () => showError("Error getting encryption settings.")
    }).then(settings => {
        passwordDerivedKeySalt = settings.password_derived_key_salt;
        encryptionSessionTimeout = settings.encryption_session_timeout;
        encryptedDataKey = settings.encrypted_data_key;
    });

    function setEncryptionSessionTimeout(encSessTimeout) {
        encryptionSessionTimeout = encSessTimeout;
    }

    function ensureProtectedSession(requireEncryption, modal) {
        const dfd = $.Deferred();

        if (requireEncryption && !isEncryptionAvailable()) {
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

    async function setupEncryptionSession() {
        const password = encryptionPasswordEl.val();
        encryptionPasswordEl.val("");

        const response = await enterProtectedSession(password);

        if (!response.success) {
            showError("Wrong password.");
            return;
        }

        protectedSessionId = response.protectedSessionId;
        initAjax();

        dialogEl.dialog("close");

        noteEditor.reload();
        noteTree.reload();

        if (encryptionDeferred !== null) {
            encryptionDeferred.resolve();

            encryptionDeferred = null;
        }
    }

    async function enterProtectedSession(password) {
        return await $.ajax({
            url: baseApiUrl + 'login/protected',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password: password
            }),
            error: () => showError("Error entering protected session.")
        });
    }

    function getProtectedSessionId() {
        return protectedSessionId;
    }

    function resetEncryptionSession() {
        protectedSessionId = null;

        initAjax();

        // most secure solution - guarantees nothing remained in memory
        // since this expires because user doesn't use the app, it shouldn't be disruptive
        window.location.reload(true);
    }

    function isEncryptionAvailable() {
        return protectedSessionId !== null;
    }

    function getDataAes() {
        lastEncryptionOperationDate = new Date();

        return new aesjs.ModeOfOperation.ctr(dataKey, new aesjs.Counter(5));
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

        note.detail.is_protected = true;

        return note;
    }

    async function protectNoteAndSendToServer() {
        await ensureProtectedSession(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.is_protected = true;

        await noteEditor.saveNoteToServer(note);

        noteEditor.setNoteBackgroundIfEncrypted(note);
    }

    async function changeEncryptionOnNoteHistory(noteId, protect) {
        const result = await $.ajax({
            url: baseApiUrl + 'notes-history/' + noteId + "?encryption=" + (protect ? 0 : 1),
            type: 'GET',
            error: () => showError("Error getting note history.")
        });

        for (const row of result) {
            if (protect) {
                row.note_title = encryptString(row.note_title);
                row.note_text = encryptString(row.note_text);
            }
            else {
                row.note_title = decryptString(row.note_title);
                row.note_text = decryptString(row.note_text);
            }

            row.is_protected = protect;

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

    async function unprotectNoteAndSendToServer() {
        await ensureProtectedSession(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.is_protected = false;

        await noteEditor.saveNoteToServer(note);

        await changeEncryptionOnNoteHistory(note.detail.note_id, false);

        noteEditor.setNoteBackgroundIfEncrypted(note);
    }

    async function encryptSubTree(noteId) {
        await ensureProtectedSession(true, true);

        updateSubTreeRecursively(noteId, note => {
                if (!note.detail.is_protected) {
                    encryptNote(note);

                    note.detail.is_protected = true;

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
        await ensureProtectedSession(true, true);

        updateSubTreeRecursively(noteId, note => {
                if (note.detail.is_protected) {
                    decryptNote(note);

                    note.detail.is_protected = false;

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
        setEncryptionSessionTimeout,
        ensureProtectedSession,
        resetEncryptionSession,
        isEncryptionAvailable,
        encryptString,
        decryptString,
        protectNoteAndSendToServer,
        unprotectNoteAndSendToServer,
        encryptSubTree,
        decryptSubTree,
        getProtectedSessionId
    };
})();