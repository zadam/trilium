"use strict";

const messagingService = require('./messaging');

// importId => ImportContext
const importContexts = {};

class ImportContext {
    constructor(importId, options) {
        // importId is to distinguish between different import events - it is possible (though not recommended)
        // to have multiple imports going at the same time
        this.importId = importId;

        this.safeImport = options.safeImport;
        this.shrinkImages = options.shrinkImages;
        this.codeImportedAsCode = options.codeImportedAsCode;
        this.textImportedAsText = options.textImportedAsText;

        // // count is mean to represent count of exported notes where practical, otherwise it's just some measure of progress
        this.progressCount = 0;
        this.lastSentCountTs = Date.now();
    }

    /** @return {ImportContext} */
    static getInstance(importId, options) {
        if (!importContexts[importId]) {
            importContexts[importId] = new ImportContext(importId, options);
        }

        return importContexts[importId];
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

    // must remaing non-static
    async reportError(message) {
        await messagingService.sendMessageToAllClients({
            type: 'import-error',
            message: message
        });
    }
}

module.exports = ImportContext;