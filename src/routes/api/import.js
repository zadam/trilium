"use strict";

const repository = require('../../services/repository');
const enexImportService = require('../../services/import/enex');
const opmlImportService = require('../../services/import/opml');
const tarImportService = require('../../services/import/tar');
const singleImportService = require('../../services/import/single');
const cls = require('../../services/cls');
const path = require('path');
const noteCacheService = require('../../services/note_cache');
const log = require('../../services/log');
const ImportContext = require('../../services/import_context');

async function importToBranch(req) {
    const {parentNoteId} = req.params;
    const {importId} = req.body;

    const options = {
        safeImport: req.body.safeImport !== 'false',
        shrinkImages: req.body.shrinkImages !== 'false',
        textImportedAsText: req.body.textImportedAsText !== 'false',
        codeImportedAsCode: req.body.codeImportedAsCode !== 'false',
        explodeArchives: req.body.explodeArchives !== 'false'
    };

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

    const importContext = ImportContext.getInstance(importId, options);

    try {
        if (extension === '.tar' && options.explodeArchives) {
            note = await tarImportService.importTar(importContext, file.buffer, parentNote);
        } else if (extension === '.opml' && options.explodeArchives) {
            note = await opmlImportService.importOpml(importContext, file.buffer, parentNote);
        } else if (extension === '.enex' && options.explodeArchives) {
            note = await enexImportService.importEnex(importContext, file, parentNote);
        } else {
            note = await singleImportService.importSingleFile(importContext, file, parentNote);
        }
    }
    catch (e) {
        const message = "Import failed with following error: '" + e.message + "'. More details might be in the logs.";
        importContext.reportError(message);

        log.error(message + e.stack);

        return [500, message];
    }

    // import has deactivated note events so note cache is not updated
    // instead we force it to reload (can be async)
    noteCacheService.load();

    return note;
}

module.exports = {
    importToBranch
};