import treeService from './tree.js';
import noteDetailService from './note_detail.js';
import utils from './utils.js';
import server from './server.js';
import protectedSessionHolder from './protected_session_holder.js';
import toastService from "./toast.js";
import ws from "./ws.js";
import appContext from "./app_context.js";

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

        import("../dialogs/protected_session.js").then(dialog => dialog.show());
    }

    return dfd.promise();
}

async function setupProtectedSession(password) {
    const response = await enterProtectedSessionOnServer(password);

    if (!response.success) {
        toastService.showError("Wrong password.", 3000);
        return;
    }

    $("#container").addClass('protected-session-active');

    protectedSessionHolder.setProtectedSessionId(response.protectedSessionId);
    protectedSessionHolder.touchProtectedSession();

    appContext.trigger('protectedSessionStarted');

    if (protectedSessionDeferred !== null) {
        import("../dialogs/protected_session.js").then(dialog => dialog.close());

        protectedSessionDeferred.resolve(true);
        protectedSessionDeferred = null;
    }

    $enterProtectedSessionButton.hide();
    $leaveProtectedSessionButton.show();

    toastService.showMessage("Protected session has been started.");
}

async function enterProtectedSessionOnServer(password) {
    return await server.post('login/protected', {
        password: password
    });
}

async function protectNoteAndSendToServer() {
    if (!appContext.getActiveTabNote() || appContext.getActiveTabNote().isProtected) {
        return;
    }

    await enterProtectedSession();

    const note = appContext.getActiveTabNote();
    note.isProtected = true;

    await appContext.getActiveTabContext().saveNote();

    treeService.setProtected(note.noteId, note.isProtected);

    await noteDetailService.reload();
}

async function unprotectNoteAndSendToServer() {
    const activeNote = appContext.getActiveTabNote();

    if (!activeNote.isProtected) {
        toastService.showAndLogError(`Note ${activeNote.noteId} is not protected`);

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

    await appContext.getActiveTabContext().saveNote();

    treeService.setProtected(activeNote.noteId, activeNote.isProtected);

    await noteDetailService.reload();
}

async function protectSubtree(noteId, protect) {
    await enterProtectedSession();

    await server.put('notes/' + noteId + "/protect/" + (protect ? 1 : 0));

    treeService.reload();
    noteDetailService.reload();
}

function makeToast(message, protectingLabel, text) {
    return {
        id: message.taskId,
        title: protectingLabel + " status",
        message: text,
        icon: message.data.protect ? "check-shield" : "shield"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'protect-notes') {
        return;
    }

    const protectingLabel = message.data.protect ? "Protecting" : "Unprotecting";

    if (message.type === 'task-error') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'task-progress-count') {
        toastService.showPersistent(makeToast(message, protectingLabel,protectingLabel + " in progress: " + message.progressCount));
    } else if (message.type === 'task-succeeded') {
        const toast = makeToast(message, protectingLabel, protectingLabel + " finished successfully.");
        toast.closeAfter = 3000;

        toastService.showPersistent(toast);
    }
});

export default {
    protectSubtree,
    enterProtectedSession,
    leaveProtectedSession,
    protectNoteAndSendToServer,
    unprotectNoteAndSendToServer,
    setupProtectedSession
};