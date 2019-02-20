"use strict";

const messagingService = require('./messaging');

class ImportContext {
    constructor(importId, safeImport) {
        // importId is to distinguish between different import events - it is possible (though not recommended)
        // to have multiple imports going at the same time
        this.importId = importId;

        this.safeImport = safeImport;

        // // count is mean to represent count of exported notes where practical, otherwise it's just some measure of progress
        this.progressCount = 0;
        this.lastSentCountTs = Date.now();
    }

    async increaseProgressCount() {
        this.progressCount++;

        if (Date.now() - this.lastSentCountTs >= 500) {
            this.lastSentCountTs = Date.now();

            await messagingService.sendMessageToAllClients({
                importId: this.importId,
                type: 'import-progress-count',
                progressCount: this.progressCount
            });
        }
    }

    async importFinished(noteId) {
        await messagingService.sendMessageToAllClients({
            importId: this.importId,
            type: 'import-finished',
            noteId: noteId
        });
    }

    // must remaing non-static
    async reportError(message) {
        await messagingService.sendMessageToAllClients({
            type: 'import-error',
            message: message
        });
    }
}

module.exports = ImportContext;