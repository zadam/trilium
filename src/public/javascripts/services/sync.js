import server from './server.js';
import infoService from "./info.js";

async function syncNow() {
    const result = await server.post('sync/now');

    if (result.success) {
        infoService.showMessage("Sync finished successfully.");
    }
    else {
        if (result.message.length > 50) {
            result.message = result.message.substr(0, 50);
        }

        infoService.showError("Sync failed: " + result.message);
    }
}

$("#sync-now-button").click(syncNow);

async function forceNoteSync(noteId) {
    await server.post('sync/force-note-sync/' + noteId);

    infoService.showMessage("Note added to sync queue.");
}

export default {
    syncNow,
    forceNoteSync
};