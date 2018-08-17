import treeService from './tree.js';
import noteDetailService from './note_detail.js';
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
const $protectedSessionOnButton = $("#protected-session-on");
const $protectedSessionOffButton = $("#protected-session-off");

let protectedSessionDeferred = null;

async function enterProtectedSession() {
    if (!protectedSessionHolder.isProtectedSessionAvailable()) {
        await ensureProtectedSession(true, true);
    }
}

async function leaveProtectedSession() {
    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        utils.reloadApp();
    }
}

function ensureProtectedSession(requireProtectedSession, modal) {
    const dfd = $.Deferred();

    if (requireProtectedSession && !protectedSessionHolder.isProtectedSessionAvailable()) {
        // using deferred instead of promise because it allows resolving from outside
        protectedSessionDeferred = dfd;

        if (treeService.getCurrentNode().data.isProtected) {
            $noteDetailWrapper.hide();
        }

        $dialog.dialog({
            // everything is now non-modal, because modal dialog caused weird high CPU usage on opening
            // and tearing of text input
            modal: false,
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

    const response = await enterProtectedSessionOnServer(password);

    if (!response.success) {
        infoService.showError("Wrong password.");
        return;
    }

    protectedSessionHolder.setProtectedSessionId(response.protectedSessionId);

    $dialog.dialog("close");

    noteDetailService.reload();
    treeService.reload();

    if (protectedSessionDeferred !== null) {
        ensureDialogIsClosed($dialog, $password);

        $noteDetailWrapper.show();

        protectedSessionDeferred.resolve();
        protectedSessionDeferred = null;

        $protectedSessionOnButton.addClass('active');
        $protectedSessionOffButton.removeClass('active');
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

async function enterProtectedSessionOnServer(password) {
    return await server.post('login/protected', {
        password: password
    });
}

async function protectNoteAndSendToServer() {
    if (noteDetailService.getCurrentNote().isProtected) {
        return;
    }

    await ensureProtectedSession(true, true);

    const note = noteDetailService.getCurrentNote();
    note.isProtected = true;

    await noteDetailService.saveNote(note);

    treeService.setProtected(note.noteId, note.isProtected);

    noteDetailService.setNoteBackgroundIfProtected(note);
}

async function unprotectNoteAndSendToServer() {
    if (!noteDetailService.getCurrentNote().isProtected) {
        return;
    }

    if (!protectedSessionHolder.isProtectedSessionAvailable()) {
        console.log("Unprotecting notes outside of protected session is not allowed.");
        // the reason is that it's not easy to handle even with ensureProtectedSession,
        // because we would first have to make sure the note is loaded and only then unprotect
        // we used to have a bug where we would overwrite the previous note with unprotected content.

        return;
    }

    const note = noteDetailService.getCurrentNote();
    note.isProtected = false;

    await noteDetailService.saveNote(note);

    treeService.setProtected(note.noteId, note.isProtected);

    noteDetailService.setNoteBackgroundIfProtected(note);
}

async function protectBranch(noteId, protect) {
    await ensureProtectedSession(true, true);

    await server.put('notes/' + noteId + "/protect/" + (protect ? 1 : 0));

    infoService.showMessage("Request to un/protect sub tree has finished successfully");

    treeService.reload();
    noteDetailService.reload();
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
    protectBranch,
    ensureDialogIsClosed,
    enterProtectedSession,
    leaveProtectedSession
};