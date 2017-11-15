"use strict";

const encryption = (function() {
    const dialogEl = $("#protected-session-password-dialog");
    const passwordFormEl = $("#protected-session-password-form");
    const passwordEl = $("#protected-session-password");

    let protectedSessionDeferred = null;
    let lastProtectedSessionOperationDate = null;
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

    function ensureProtectedSession(requireProtectedSession, modal) {
        const dfd = $.Deferred();

        if (requireProtectedSession && !isProtectedSessionAvailable()) {
            // if this is entry point then we need to show the app even before the note is loaded
            showAppIfHidden();

            protectedSessionDeferred = dfd;

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
        const password = passwordEl.val();
        passwordEl.val("");

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

        if (protectedSessionDeferred !== null) {
            protectedSessionDeferred.resolve();

            protectedSessionDeferred = null;
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

    function resetProtectedSession() {
        protectedSessionId = null;

        initAjax();

        // most secure solution - guarantees nothing remained in memory
        // since this expires because user doesn't use the app, it shouldn't be disruptive
        window.location.reload(true);
    }

    function isProtectedSessionAvailable() {
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

    passwordFormEl.submit(() => {
        setupProtectedSession();

        return false;
    });

    setInterval(() => {
        if (lastProtectedSessionOperationDate !== null && new Date().getTime() - lastProtectedSessionOperationDate.getTime() > encryptionSessionTimeout * 1000) {
            resetProtectedSession();
        }
    }, 5000);

    return {
        setEncryptionSessionTimeout,
        ensureProtectedSession,
        resetProtectedSession,
        isProtectedSessionAvailable,
        protectNoteAndSendToServer,
        unprotectNoteAndSendToServer,
        getProtectedSessionId
    };
})();