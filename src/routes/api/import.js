"use strict";

const repository = require('../../services/repository');
const enexImportService = require('../../services/import/enex');
const opmlImportService = require('../../services/import/opml');
const tarImportService = require('../../services/import/tar');
const singleImportService = require('../../services/import/single');
const cls = require('../../services/cls');
const path = require('path');

async function importToBranch(req) {
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;

    if (!file) {
        return [400, "No file has been uploaded"];
    }

    const parentNote = await repository.getNote(parentNoteId);

    if (!parentNote) {
        return [404, `Note ${parentNoteId} doesn't exist.`];
    }

    const extension = path.extname(file.originalname).toLowerCase();

    // running all the event handlers on imported notes (and attributes) is slow
    // and may produce unintended consequences
    cls.disableEntityEvents();

    if (extension === '.tar') {
        return await tarImportService.importTar(file.buffer, parentNote);
    }
    else if (extension === '.opml') {
        return await opmlImportService.importOpml(file.buffer, parentNote);
    }
    else if (extension === '.md') {
        return await singleImportService.importMarkdown(file, parentNote);
    }
    else if (extension === '.html' || extension === '.htm') {
        return await singleImportService.importHtml(file, parentNote);
    }
    else if (extension === '.enex') {
        return await enexImportService.importEnex(file, parentNote);
    }
    else {
        return [400, `Unrecognized extension ${extension}, must be .tar or .opml`];
    }
}

module.exports = {
    importToBranch
};