"use strict";

const tarExportService = require('../../services/export/tar');
const singleExportService = require('../../services/export/single');
const opmlExportService = require('../../services/export/opml');
const repository = require("../../services/repository");

async function exportBranch(req, res) {
    const {branchId, type, format} = req.params;
    const branch = await repository.getBranch(branchId);

    if (type === 'subtree' && (format === 'html' || format === 'markdown')) {
        await tarExportService.exportToTar(branch, format, res);
    }
    else if (type === 'single') {
        await singleExportService.exportSingleNote(branch, format, res);
    }
    else if (format === 'opml') {
        await opmlExportService.exportToOpml(branch, res);
    }
    else {
        return [404, "Unrecognized export format " + format];
    }
}

module.exports = {
    exportBranch
};