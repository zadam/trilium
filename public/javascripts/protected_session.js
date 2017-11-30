"use strict";

const protected_session = (function() {
    const dialogEl = $("#protected-session-password-dialog");
    const passwordFormEl = $("#protected-session-password-form");
    const passwordEl = $("#protected-session-password");

    let protectedSessionDeferred = null;
    let lastProtectedSessionOperationDate = null;
    let protectedSessionTimeout = null;
    let protectedSessionId = null;

    server.get('settings/all').then(settings => {
        protectedSessionTimeout = settings.protected_session_timeout;
    });

    function setProtectedSessionTimeout(encSessTimeout) {
        protectedSessionTimeout = encSessTimeout;
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
                        noteTree.getCurrentNode().setFocus();
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
        server.initAjax();

        dialogEl.dialog("close");

        noteEditor.reload();
        noteTree.reload();

        if (protectedSessionDeferred !== null) {
            ensureDialogIsClosed(dialogEl, passwordEl);

            protectedSessionDeferred.resolve();

            protectedSessionDeferred = null;
        }
    }

    function ensureDialogIsClosed() {
        // this may fal if the dialog has not been previously opened
        try {
            dialogEl.dialog('close');
        }
        catch (e) {}

        passwordEl.val('');
    }

    async function enterProtectedSession(password) {
        return await server.post('login/protected', {
            password: password
        });
    }

    function getProtectedSessionId() {
        return protectedSessionId;
    }

    function resetProtectedSession() {
        protectedSessionId = null;

        server.initAjax();

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

    function touchProtectedSession() {
        if (isProtectedSessionAvailable()) {
            lastProtectedSessionOperationDate = new Date();
        }
    }

    async function protectSubTree(noteId, protect) {
        await ensureProtectedSession(true, true);

        await server.put('tree/' + noteId + "/protectSubTree/" + (protect ? 1 : 0));

        showMessage("Request to un/protect sub tree has finished successfully");

        noteTree.reload();
        noteEditor.reload();
    }

    passwordFormEl.submit(() => {
        setupProtectedSession();

        return false;
    });

    setInterval(() => {
        if (lastProtectedSessionOperationDate !== null && new Date().getTime() - lastProtectedSessionOperationDate.getTime() > protectedSessionTimeout * 1000) {
            resetProtectedSession();
        }
    }, 5000);

    return {
        setProtectedSessionTimeout,
        ensureProtectedSession,
        resetProtectedSession,
        isProtectedSessionAvailable,
        protectNoteAndSendToServer,
        unprotectNoteAndSendToServer,
        getProtectedSessionId,
        touchProtectedSession,
        protectSubTree,
        ensureDialogIsClosed
    };
})();