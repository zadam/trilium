"use strict";

const protected_session = (function() {
    const $dialog = $("#protected-session-password-dialog");
    const $passwordForm = $("#protected-session-password-form");
    const $password = $("#protected-session-password");
    const $noteDetailWrapper = $("#note-detail-wrapper");

    let protectedSessionDeferred = null;
    let lastProtectedSessionOperationDate = null;
    let protectedSessionTimeout = null;
    let protectedSessionId = null;

    $(document).ready(() => {
        server.get('settings/all').then(settings => protectedSessionTimeout = settings.protected_session_timeout);
    });

    function setProtectedSessionTimeout(encSessTimeout) {
        protectedSessionTimeout = encSessTimeout;
    }

    function ensureProtectedSession(requireProtectedSession, modal) {
        const dfd = $.Deferred();

        if (requireProtectedSession && !isProtectedSessionAvailable()) {
            protectedSessionDeferred = dfd;

            if (noteTree.getCurrentNode().data.isProtected) {
                $noteDetailWrapper.hide();
            }

            $dialog.dialog({
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
        const password = $password.val();
        $password.val("");

        const response = await enterProtectedSession(password);

        if (!response.success) {
            showError("Wrong password.");
            return;
        }

        protectedSessionId = response.protectedSessionId;

        $dialog.dialog("close");

        noteEditor.reload();
        noteTree.reload();

        if (protectedSessionDeferred !== null) {
            ensureDialogIsClosed($dialog, $password);

            $noteDetailWrapper.show();

            protectedSessionDeferred.resolve();

            protectedSessionDeferred = null;
        }
    }

    function ensureDialogIsClosed() {
        // this may fal if the dialog has not been previously opened
        try {
            $dialog.dialog('close');
        }
        catch (e) {}

        $password.val('');
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

        // most secure solution - guarantees nothing remained in memory
        // since this expires because user doesn't use the app, it shouldn't be disruptive
        reloadApp();
    }

    function isProtectedSessionAvailable() {
        return protectedSessionId !== null;
    }

    async function protectNoteAndSendToServer() {
        await ensureProtectedSession(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.isProtected = true;

        await noteEditor.saveNoteToServer(note);

        noteTree.setProtected(note.detail.noteId, note.detail.isProtected);

        noteEditor.setNoteBackgroundIfProtected(note);
    }

    async function unprotectNoteAndSendToServer() {
        await ensureProtectedSession(true, true);

        const note = noteEditor.getCurrentNote();

        noteEditor.updateNoteFromInputs(note);

        note.detail.isProtected = false;

        await noteEditor.saveNoteToServer(note);

        noteTree.setProtected(note.detail.noteId, note.detail.isProtected);

        noteEditor.setNoteBackgroundIfProtected(note);
    }

    function touchProtectedSession() {
        if (isProtectedSessionAvailable()) {
            lastProtectedSessionOperationDate = new Date();
        }
    }

    async function protectSubTree(noteId, protect) {
        await ensureProtectedSession(true, true);

        await server.put('notes/' + noteId + "/protect-sub-tree/" + (protect ? 1 : 0));

        showMessage("Request to un/protect sub tree has finished successfully");

        noteTree.reload();
        noteEditor.reload();
    }

    $passwordForm.submit(() => {
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