"use strict";

async function syncNow() {
    const result = await server.post('sync/now');

    if (result.success) {
        showMessage("Sync finished successfully.");
    }
    else {
        if (result.message.length > 50) {
            result.message = result.message.substr(0, 50);
        }

        showError("Sync failed: " + result.message);
    }
}

$("#sync-now-button").click(syncNow);

async function forceNoteSync(noteId) {
    const result = await server.post('sync/force-note-sync/' + noteId);

    showMessage("Note added to sync queue.");
}