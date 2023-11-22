"use strict";

const zipExportService = require('../../services/export/zip.js');
const singleExportService = require('../../services/export/single.js');
const opmlExportService = require('../../services/export/opml.js');
const becca = require('../../becca/becca.js');
const TaskContext = require('../../services/task_context.js');
const log = require('../../services/log.js');
const NotFoundError = require('../../errors/not_found_error.js');

function exportBranch(req, res) {
    const {branchId, type, format, version, taskId} = req.params;
    const branch = becca.getBranch(branchId);

    if (!branch) {
        const message = `Cannot export branch '${branchId}' since it does not exist.`;
        log.error(message);

        res.setHeader("Content-Type", "text/plain")
            .status(500)
            .send(message);
        return;
    }

    const taskContext = new TaskContext(taskId, 'export');

    try {
        if (type === 'subtree' && (format === 'html' || format === 'markdown')) {
            zipExportService.exportToZip(taskContext, branch, format, res);
        }
        else if (type === 'single') {
            singleExportService.exportSingleNote(taskContext, branch, format, res);
        }
        else if (format === 'opml') {
            opmlExportService.exportToOpml(taskContext, branch, version, res);
        }
        else {
            throw new NotFoundError(`Unrecognized export format '${format}'`);
        }
    }
    catch (e) {
        const message = `Export failed with following error: '${e.message}'. More details might be in the logs.`;
        taskContext.reportError(message);

        log.error(message + e.stack);

        res.setHeader("Content-Type", "text/plain")
            .status(500)
            .send(message);
    }
}

module.exports = {
    exportBranch
};
