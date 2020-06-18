import server from './server.js';
import toastService from "./toast.js";

async function syncNow() {
    const result = await server.post('sync/now');

    if (result.success) {
        toastService.showMessage("Sync finished successfully.");
    }
    else {
        if (result.message.length > 100) {
            result.message = result.message.substr(0, 100);
        }

        toastService.showError("Sync failed: " + result.message);
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
