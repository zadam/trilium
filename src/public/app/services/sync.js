import server from './server.js';
import toastService from "./toast.js";

async function syncNow(ignoreNotConfigured = false) {
    const result = await server.post('sync/now');

    if (result.success) {
        toastService.showMessage("Sync finished successfully.");
    }
    else {
        if (result.message.length > 200) {
            result.message = result.message.substr(0, 200) + "...";
        }

        if (!ignoreNotConfigured || result.errorCode !== 'NOT_CONFIGURED') {
            toastService.showError("Sync failed: " + result.message);
        }
    }
}

async function forceNoteSync(noteId) {
    await server.post('sync/force-note-sync/' + noteId);

    toastService.showMessage("Note added to sync queue.");
}

export default {
    syncNow,
    forceNoteSync
};
