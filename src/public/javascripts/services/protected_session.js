import treeService from './tree.js';
import noteDetailService from './note_detail.js';
import utils from './utils.js';
import server from './server.js';
import protectedSessionHolder from './protected_session_holder.js';
import infoService from "./info.js";
import protectedSessionDialog from "../dialogs/protected_session.js";

const $enterProtectedSessionButton = $("#enter-protected-session-button");
const $leaveProtectedSessionButton = $("#leave-protected-session-button");

let protectedSessionDeferred = null;

async function leaveProtectedSession() {
    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        utils.reloadApp();
    }
}

/** returned promise resolves with true if new protected session was established, false if no action was necessary */
function enterProtectedSession() {
    const dfd = $.Deferred();

    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        dfd.resolve(false);
    }
    else {
        // using deferred instead of promise because it allows resolving from outside
        protectedSessionDeferred = dfd;

        protectedSessionDialog.show();
    }

    return dfd.promise();
}

async function setupProtectedSession(password) {
    const response = await enterProtectedSessionOnServer(password);

    if (!response.success) {
        infoService.showError("Wrong password.", 3000);
        return;
    }

    protectedSessionHolder.setProtectedSessionId(response.protectedSessionId);
    protectedSessionHolder.touchProtectedSession();

    await treeService.reload();

    // it's important that tree has been already reloaded at this point since detail also uses tree cache (for children overview)
    // children overview is the reason why we need to reload all tabs
    await noteDetailService.reloadAllTabs();

    if (protectedSessionDeferred !== null) {
        protectedSessionDialog.close();

        protectedSessionDeferred.resolve(true);
        protectedSessionDeferred = null;
    }

    $enterProtectedSessionButton.hide();
    $leaveProtectedSessionButton.show();

    infoService.showMessage("Protected session has been started.");
}

async function enterProtectedSessionOnServer(password) {
    return await server.post('login/protected', {
        password: password
    });
}

async function protectNoteAndSendToServer() {
    if (!noteDetailService.getActiveNote() || noteDetailService.getActiveNote().isProtected) {
        return;
    }

    await enterProtectedSession();

    const note = noteDetailService.getActiveNote();
    note.isProtected = true;

    await noteDetailService.getActiveTabContext().saveNote();

    treeService.setProtected(note.noteId, note.isProtected);

    await noteDetailService.reload();
}

async function unprotectNoteAndSendToServer() {
    const activeNote = noteDetailService.getActiveNote();

    if (!activeNote.isProtected) {
        infoService.showAndLogError(`Note ${activeNote.noteId} is not protected`);

        return;
    }

    if (!protectedSessionHolder.isProtectedSessionAvailable()) {
        console.log("Unprotecting notes outside of protected session is not allowed.");
        // the reason is that it's not easy to handle even with enterProtectedSession,
        // because we would first have to make sure the note is loaded and only then unprotect
        // we used to have a bug where we would overwrite the previous note with unprotected content.

        return;
    }

    activeNote.isProtected = false;

    await noteDetailService.getActiveTabContext().saveNote();

    treeService.setProtected(activeNote.noteId, activeNote.isProtected);

    await noteDetailService.reload();
}

async function protectSubtree(noteId, protect) {
    await enterProtectedSession();

    await server.put('notes/' + noteId + "/protect/" + (protect ? 1 : 0));

    infoService.showMessage("Request to un/protect sub tree has finished successfully");

    treeService.reload();
    noteDetailService.reload();
}

export default {
    protectSubtree,
    enterProtectedSession,
    leaveProtectedSession,
    protectNoteAndSendToServer,
    unprotectNoteAndSendToServer,
    setupProtectedSession
};