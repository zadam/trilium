import server from './server.js';
import protectedSessionHolder from './protected_session_holder.js';
import toastService from "./toast.js";
import ws from "./ws.js";
import appContext from "../components/app_context.js";
import froca from "./froca.js";
import utils from "./utils.js";
import options from "./options.js";

let protectedSessionDeferred = null;

async function leaveProtectedSession() {
    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        await protectedSessionHolder.resetProtectedSession();
    }
}

/** returned promise resolves with true if new protected session was established, false if no action was necessary */
function enterProtectedSession() {
    const dfd = $.Deferred();

    if (!options.is("isPasswordSet")) {
        appContext.triggerCommand("showPasswordNotSet");
        return dfd;
    }

    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        dfd.resolve(false);
    }
    else {
        // using deferred instead of promise because it allows resolving from the outside
        protectedSessionDeferred = dfd;

        appContext.triggerCommand("showProtectedSessionPasswordDialog");
    }

    return dfd.promise();
}

async function reloadData() {
    const allNoteIds = Object.keys(froca.notes);

    await froca.loadInitialTree();

    // make sure that all notes used in the application are loaded, including the ones not shown in the tree
    await froca.reloadNotes(allNoteIds, true);
}

async function setupProtectedSession(password) {
    const response = await server.post('login/protected', { password: password });

    if (!response.success) {
        toastService.showError("Wrong password.", 3000);
        return;
    }

    protectedSessionHolder.enableProtectedSession();
}

ws.subscribeToMessages(async message => {
    if (message.type === 'protectedSessionLogin') {
        await reloadData();

        await appContext.triggerEvent('frocaReloaded');

        appContext.triggerEvent('protectedSessionStarted');

        appContext.triggerCommand("closeProtectedSessionPasswordDialog");

        if (protectedSessionDeferred !== null) {
            protectedSessionDeferred.resolve(true);
            protectedSessionDeferred = null;
        }

        toastService.showMessage("Protected session has been started.");
    }
    else if (message.type === 'protectedSessionLogout') {
        utils.reloadFrontendApp(`Protected session logout`);
    }
});

async function protectNote(noteId, protect, includingSubtree) {
    await enterProtectedSession();

    await server.put(`notes/${noteId}/protect/${protect ? 1 : 0}?subtree=${includingSubtree ? 1 : 0}`);
}

function makeToast(message, protectingLabel, text) {
    return {
        id: message.taskId,
        title: `${protectingLabel} status`,
        message: text,
        icon: message.data.protect ? "check-shield" : "shield"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'protectNotes') {
        return;
    }

    const protectingLabel = message.data.protect ? "Protecting" : "Unprotecting";

    if (message.type === 'taskError') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'taskProgressCount') {
        toastService.showPersistent(makeToast(message, protectingLabel,`${protectingLabel} in progress: ${message.progressCount}`));
    } else if (message.type === 'taskSucceeded') {
        const toast = makeToast(message, protectingLabel, `${protectingLabel} finished successfully.`);
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
