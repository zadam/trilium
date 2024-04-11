"use strict";

import zipExportService = require('../../services/export/zip');
import singleExportService = require('../../services/export/single');
import opmlExportService = require('../../services/export/opml');
import becca = require('../../becca/becca');
import TaskContext = require('../../services/task_context');
import log = require('../../services/log');
import NotFoundError = require('../../errors/not_found_error');
import { Request, Response } from 'express';
import ValidationError = require('../../errors/validation_error');

function exportBranch(req: Request, res: Response) {
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
            if (format !== "html" && format !== "markdown") {
                throw new ValidationError("Invalid export type.");
            }
            singleExportService.exportSingleNote(taskContext, branch, format, res);
        }
        else if (format === 'opml') {
            opmlExportService.exportToOpml(taskContext, branch, version, res);
        }
        else {
            throw new NotFoundError(`Unrecognized export format '${format}'`);
        }
    }
    catch (e: any) {
        const message = `Export failed with following error: '${e.message}'. More details might be in the logs.`;
        taskContext.reportError(message);

        log.error(message + e.stack);

        res.setHeader("Content-Type", "text/plain")
            .status(500)
            .send(message);
    }
}

export = {
    exportBranch
};
