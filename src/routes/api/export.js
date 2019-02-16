"use strict";

const tarExportService = require('../../services/export/tar');
const singleExportService = require('../../services/export/single');
const opmlExportService = require('../../services/export/opml');
const repository = require("../../services/repository");
const messagingService = require("../../services/messaging");
const log = require("../../services/log");

class ExportContext {
    constructor(exportId) {
        // exportId is to distinguish between different export events - it is possible (though not recommended)
        // to have multiple exports going at the same time
        this.exportId = exportId;
        // count is mean to represent count of exported notes where practical, otherwise it's just some measure of progress
        this.progressCount = 0;
        this.lastSentCountTs = Date.now();
    }

    async increaseProgressCount() {
        this.progressCount++;

        if (Date.now() - this.lastSentCountTs >= 500) {
            this.lastSentCountTs = Date.now();

            await messagingService.sendMessageToAllClients({
                exportId: this.exportId,
                type: 'export-progress-count',
                progressCount: this.progressCount
            });
        }
    }

    async exportFinished() {
        await messagingService.sendMessageToAllClients({
            exportId: this.exportId,
            type: 'export-finished'
        });
    }

    // must remaing non-static
    async reportError(message) {
        await messagingService.sendMessageToAllClients({
            type: 'export-error',
            message: message
        });
    }
}

async function exportBranch(req, res) {
    const {branchId, type, format, version, exportId} = req.params;
    const branch = await repository.getBranch(branchId);

    const exportContext = new ExportContext(exportId);

    try {
        if (type === 'subtree' && (format === 'html' || format === 'markdown')) {
            await tarExportService.exportToTar(exportContext, branch, format, res);
        }
        else if (type === 'single') {
            await singleExportService.exportSingleNote(exportContext, branch, format, res);
        }
        else if (format === 'opml') {
            await opmlExportService.exportToOpml(exportContext, branch, version, res);
        }
        else {
            return [404, "Unrecognized export format " + format];
        }
    }
    catch (e) {
        const message = "Export failed with following error: '" + e.message + "'. More details might be in the logs.";
        exportContext.reportError(message);

        log.error(message + e.stack);

        res.status(500).send(message);
    }
}

module.exports = {
    exportBranch
};