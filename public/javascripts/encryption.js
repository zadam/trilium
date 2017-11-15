"use strict";

const encryption = (function() {
    const dialogEl = $("#encryption-password-dialog");
    const encryptionPasswordFormEl = $("#encryption-password-form");
    const encryptionPasswordEl = $("#encryption-password");

    let encryptionDeferred = null;
    let lastEncryptionOperationDate = null;
    let encryptionSessionTimeout = null;
    let protectedSessionId = null;

    $.ajax({
        url: baseApiUrl + 'settings/all',
        type: 'GET',
        error: () => showError("Error getting encryption settings.")
    }).then(settings => {
        encryptionSessionTimeout = settings.encryption_session_timeout;
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

    async function setupProtectedSession() {
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

    async function protectNoteAndSendToServer() {
        await ensureProtectedSession(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.is_protected = true;

        await noteEditor.saveNoteToServer(note);

        noteEditor.setNoteBackgroundIfProtected(note);
    }

    async function unprotectNoteAndSendToServer() {
        await ensureProtectedSession(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.is_protected = false;

        await noteEditor.saveNoteToServer(note);

        noteEditor.setNoteBackgroundIfProtected(note);
    }

    encryptionPasswordFormEl.submit(() => {
        setupProtectedSession();

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
        protectNoteAndSendToServer,
        unprotectNoteAndSendToServer,
        getProtectedSessionId
    };
})();