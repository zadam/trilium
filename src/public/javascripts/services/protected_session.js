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
const $enterProtectedSessionButton = $("#enter-protected-session-button");
const $leaveProtectedSessionButton = $("#leave-protected-session-button");

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

/** returned promise resolves with true if new protected session was established, false if no action was necessary */
function ensureProtectedSession(requireProtectedSession, modal) {
    const dfd = $.Deferred();

    if (requireProtectedSession && !protectedSessionHolder.isProtectedSessionAvailable()) {
        // using deferred instead of promise because it allows resolving from outside
        protectedSessionDeferred = dfd;

        if (treeService.getCurrentNode().data.isProtected) {
            $noteDetailWrapper.hide();
        }

        $dialog.toggleClass("modalless", !modal);
        $dialog.modal();
    }
    else {
        dfd.resolve(false);
    }

    return dfd.promise();
}

async function setupProtectedSession() {
    const password = $password.val();
    $password.val("");

    const response = await enterProtectedSessionOnServer(password);

    if (!response.success) {
        infoService.showError("Wrong password.", 3000);
        return;
    }

    protectedSessionHolder.setProtectedSessionId(response.protectedSessionId);

    $dialog.modal("hide");

    await treeService.reload();

    // it's important that tree has been already reloaded at this point
    // since detail also uses tree cache (for children overview)
    await noteDetailService.reload();

    if (protectedSessionDeferred !== null) {
        ensureDialogIsClosed($dialog, $password);

        $noteDetailWrapper.show();

        protectedSessionDeferred.resolve(true);
        protectedSessionDeferred = null;

        $enterProtectedSessionButton.hide();
        $leaveProtectedSessionButton.show();
    }

    infoService.showMessage("Protected session has been started.");
}

function ensureDialogIsClosed() {
    // this may fal if the dialog has not been previously opened (not sure if still true with Bootstrap modal)
    try {
        $dialog.modal('hide');
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

    noteDetailService.setNoteBackgroundIfProtected(note);console.log(note);
}

async function unprotectNoteAndSendToServer() {
    const currentNote = noteDetailService.getCurrentNote();

    if (!currentNote.isProtected) {
        infoService.showAndLogError(`Note ${currentNote.noteId} is not protected`);

        return;
    }

    if (!protectedSessionHolder.isProtectedSessionAvailable()) {
        console.log("Unprotecting notes outside of protected session is not allowed.");
        // the reason is that it's not easy to handle even with ensureProtectedSession,
        // because we would first have to make sure the note is loaded and only then unprotect
        // we used to have a bug where we would overwrite the previous note with unprotected content.

        return;
    }

    currentNote.isProtected = false;

    await noteDetailService.saveNote(currentNote);

    treeService.setProtected(currentNote.noteId, currentNote.isProtected);

    noteDetailService.setNoteBackgroundIfProtected(currentNote);
}

async function protectSubtree(noteId, protect) {
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

// this doesn't work, event is not triggered :/
$dialog.on("show.bs.modal", e => function() {
    if ($(this).hasClass("modalless")) {
        // return "stolen" focus to tree
        treeService.getCurrentNode().setFocus();
    }
    else {
        $password.focus();
    }
});

$protectButton.click(protectNoteAndSendToServer);
$unprotectButton.click(unprotectNoteAndSendToServer);

$dialog.on("shown.bs.modal", e => $password.focus());

export default {
    ensureProtectedSession,
    protectSubtree,
    ensureDialogIsClosed,
    enterProtectedSession,
    leaveProtectedSession
};