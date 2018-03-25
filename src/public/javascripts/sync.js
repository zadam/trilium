"use strict";

const syncService = (function() {
    async function syncNow() {
        const result = await server.post('sync/now');

        if (result.success) {
            utils.showMessage("Sync finished successfully.");
        }
        else {
            if (result.message.length > 50) {
                result.message = result.message.substr(0, 50);
            }

            utils.showError("Sync failed: " + result.message);
        }
    }

    $("#sync-now-button").click(syncNow);

    async function forceNoteSync(noteId) {
        const result = await server.post('sync/force-note-sync/' + noteId);

        utils.showMessage("Note added to sync queue.");
    }

    return {
        syncNow,
        forceNoteSync
    };
})();