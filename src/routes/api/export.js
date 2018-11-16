"use strict";

const nativeTarExportService = require('../../services/export/native_tar');
const markdownTarExportService = require('../../services/export/markdown_tar');
const markdownSingleExportService = require('../../services/export/markdown_single');
const opmlExportService = require('../../services/export/opml');
const repository = require("../../services/repository");

async function exportNote(req, res) {
    // entityId maybe either noteId or branchId depending on format
    const entityId = req.params.entityId;
    const format = req.params.format;

    if (format === 'native-tar') {
        await nativeTarExportService.exportToTar(await repository.getBranch(entityId), res);
    }
    else if (format === 'markdown-tar') {
        await markdownTarExportService.exportToMarkdown(await repository.getBranch(entityId), res);
    }
    // export single note without subtree
    else if (format === 'markdown-single') {
        await markdownSingleExportService.exportSingleMarkdown(await repository.getNote(entityId), res);
    }
    else if (format === 'opml') {
        await opmlExportService.exportToOpml(await repository.getBranch(entityId), res);
    }
    else {
        return [404, "Unrecognized export format " + format];
    }
}

module.exports = {
    exportNote
};