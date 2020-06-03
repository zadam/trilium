import utils from './utils.js';
import server from './server.js';
import protectedSessionHolder from './protected_session_holder.js';
import toastService from "./toast.js";
import ws from "./ws.js";
import appContext from "./app_context.js";
import treeCache from "./tree_cache.js";

let protectedSessionDeferred = null;

async function leaveProtectedSession() {
    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        protectedSessionHolder.resetProtectedSession();
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

async function reloadData() {
    const allNoteIds = Object.keys(treeCache.notes);

    await treeCache.loadInitialTree();

    // make sure that all notes used in the application are loaded, including the ones not shown in the tree
    await treeCache.reloadNotes(allNoteIds, true);
}

async function setupProtectedSession(password) {
    const response = await enterProtectedSessionOnServer(password);

    if (!response.success) {
        toastService.showError("Wrong password.", 3000);
        return;
    }

    protectedSessionHolder.setProtectedSessionId(response.protectedSessionId);
    protectedSessionHolder.touchProtectedSession();

    await reloadData();

    await appContext.triggerEvent('treeCacheReloaded');

    appContext.triggerEvent('protectedSessionStarted');

    if (protectedSessionDeferred !== null) {
        import("../dialogs/protected_session.js").then(dialog => dialog.close());

        protectedSessionDeferred.resolve(true);
        protectedSessionDeferred = null;
    }

    toastService.showMessage("Protected session has been started.");
}

async function enterProtectedSessionOnServer(password) {
    return await server.post('login/protected', {
        password: password
    });
}

async function protectNote(noteId, protect, includingSubtree) {
    await enterProtectedSession();

    await server.put(`notes/${noteId}/protect/${protect ? 1 : 0}?subtree=${includingSubtree ? 1 : 0}`);
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
    protectNote,
    enterProtectedSession,
    leaveProtectedSession,
    setupProtectedSession
};
