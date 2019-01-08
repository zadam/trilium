"use strict";

const repository = require('../../services/repository');
const enexImportService = require('../../services/import/enex');
const opmlImportService = require('../../services/import/opml');
const tarImportService = require('../../services/import/tar');
const singleImportService = require('../../services/import/single');
const cls = require('../../services/cls');
const path = require('path');
const noteCacheService = require('../../services/note_cache');

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

    let note; // typically root of the import - client can show it after finishing the import

    if (extension === '.tar') {
        note = await tarImportService.importTar(file.buffer, parentNote);
    }
    else if (extension === '.opml') {
        note = await opmlImportService.importOpml(file.buffer, parentNote);
    }
    else if (extension === '.md') {
        note = await singleImportService.importMarkdown(file, parentNote);
    }
    else if (extension === '.html' || extension === '.htm') {
        note = await singleImportService.importHtml(file, parentNote);
    }
    else if (extension === '.enex') {
        note = await enexImportService.importEnex(file, parentNote);
    }
    else {
        return [400, `Unrecognized extension ${extension}, must be .tar or .opml`];
    }

    // import has deactivated note events so note cache is not updated
    // instead we force it to reload (can be async)
    noteCacheService.load();

    return note;
}

module.exports = {
    importToBranch
};