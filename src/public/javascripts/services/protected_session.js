import treeService from './tree.js';
import noteDetail from './note_detail.js';
import utils from './utils.js';
import server from './server.js';
import protectedSessionHolder from './protected_session_holder.js';
import infoService from "./info.js";

const $dialog = $("#protected-session-password-dialog");
const $passwordForm = $("#protected-session-password-form");
const $password = $("#protected-session-password");
const $noteDetailWrapper = $("#note-detail-wrapper");
const $protectButton = $("#protect-button");
const $unprotectButton = $("#unprotect-button");

let protectedSessionDeferred = null;

function ensureProtectedSession(requireProtectedSession, modal) {
    const dfd = $.Deferred();

    if (requireProtectedSession && !protectedSessionHolder.isProtectedSessionAvailable()) {
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
        infoService.showError("Wrong password.");
        return;
    }

    protectedSessionHolder.setProtectedSessionId(response.protectedSessionId);

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

async function protectNoteAndSendToServer() {
    await ensureProtectedSession(true, true);

    const note = noteDetail.getCurrentNote();

    noteDetail.updateNoteFromInputs(note);

    note.isProtected = true;

    await noteDetail.saveNoteToServer(note);

    treeService.setProtected(note.noteId, note.isProtected);

    noteDetail.setNoteBackgroundIfProtected(note);
}

async function unprotectNoteAndSendToServer() {
    await ensureProtectedSession(true, true);

    const note = noteDetail.getCurrentNote();

    noteDetail.updateNoteFromInputs(note);

    note.isProtected = false;

    await noteDetail.saveNoteToServer(note);

    treeService.setProtected(note.noteId, note.isProtected);

    noteDetail.setNoteBackgroundIfProtected(note);
}

async function protectSubTree(noteId, protect) {
    await ensureProtectedSession(true, true);

    await server.put('notes/' + noteId + "/protect-sub-tree/" + (protect ? 1 : 0));

    infoService.showMessage("Request to un/protect sub tree has finished successfully");

    treeService.reload();
    noteDetail.reload();
}

$passwordForm.submit(() => {
    setupProtectedSession();

    return false;
});

$protectButton.click(protectNoteAndSendToServer);
$unprotectButton.click(unprotectNoteAndSendToServer);

export default {
    ensureProtectedSession,
    protectNoteAndSendToServer,
    unprotectNoteAndSendToServer,
    protectSubTree,
    ensureDialogIsClosed
};