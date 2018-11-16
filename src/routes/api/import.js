"use strict";

const repository = require('../../services/repository');
const enexImportService = require('../../services/import/enex');
const opmlImportService = require('../../services/import/opml');
const tarImportService = require('../../services/import/tar');
const markdownImportService = require('../../services/import/markdown');
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

    if (extension === '.tar') {
        return await tarImportService.importTar(file, parentNote);
    }
    else if (extension === '.opml') {
        return await opmlImportService.importOpml(file, parentNote);
    }
    else if (extension === '.md') {
        return await markdownImportService.importMarkdown(file, parentNote);
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