import treeService from './tree.js';
import noteDetail from './note_detail.js';
import utils from './utils.js';
import server from './server.js';

const $dialog = $("#protected-session-password-dialog");
const $passwordForm = $("#protected-session-password-form");
const $password = $("#protected-session-password");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");

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

        if (treeService.getCurrentNode().data.isProtected) {
            $noteDetailWrapper.hide();
        }

        $dialog.dialog({
            modal: modal,
            width: 400,
            open: () => {
                if (!modal) {
                    // dialog steals focus for itself, which is not what we want for non-modal (viewing)
                    treeService.getCurrentNode().setFocus();
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
        utils.showError("Wrong password.");
        return;
    }

    protectedSessionId = response.protectedSessionId;

    $dialog.dialog("close");

    noteDetail.reload();
    treeService.reload();

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
    utils.reloadApp();
}

function isProtectedSessionAvailable() {
    return protectedSessionId !== null;
}

async function protectNoteAndSendToServer() {
    await ensureProtectedSession(true, true);

    const note = noteDetail.getCurrentNote();

    noteDetail.updateNoteFromInputs(note);

    note.detail.isProtected = true;

    await noteDetail.saveNoteToServer(note);

    treeService.setProtected(note.detail.noteId, note.detail.isProtected);

    noteDetail.setNoteBackgroundIfProtected(note);
}

async function unprotectNoteAndSendToServer() {
    await ensureProtectedSession(true, true);

    const note = noteDetail.getCurrentNote();

    noteDetail.updateNoteFromInputs(note);

    note.detail.isProtected = false;

    await noteDetail.saveNoteToServer(note);

    treeService.setProtected(note.detail.noteId, note.detail.isProtected);

    noteDetail.setNoteBackgroundIfProtected(note);
}

function touchProtectedSession() {
    if (isProtectedSessionAvailable()) {
        lastProtectedSessionOperationDate = new Date();
    }
}

async function protectSubTree(noteId, protect) {
    await ensureProtectedSession(true, true);

    await server.put('notes/' + noteId + "/protect-sub-tree/" + (protect ? 1 : 0));

    utils.showMessage("Request to un/protect sub tree has finished successfully");

    treeService.reload();
    noteDetail.reload();
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

$protectButton.click(protectNoteAndSendToServer);
$unprotectButton.click(unprotectNoteAndSendToServer);

export default {
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