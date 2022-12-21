"use strict";

const enexImportService = require('../../services/import/enex');
const opmlImportService = require('../../services/import/opml');
const zipImportService = require('../../services/import/zip');
const singleImportService = require('../../services/import/single');
const cls = require('../../services/cls');
const path = require('path');
const becca = require('../../becca/becca');
const beccaLoader = require('../../becca/becca_loader');
const log = require('../../services/log');
const TaskContext = require('../../services/task_context');
const ValidationError = require("../../errors/validation_error");
const NotFoundError = require("../../errors/not_found_error");

async function importToBranch(req) {
    const {parentNoteId} = req.params;
    const {taskId, last} = req.body;

    const options = {
        safeImport: req.body.safeImport !== 'false',
        shrinkImages: req.body.shrinkImages !== 'false',
        textImportedAsText: req.body.textImportedAsText !== 'false',
        codeImportedAsCode: req.body.codeImportedAsCode !== 'false',
        explodeArchives: req.body.explodeArchives !== 'false',
        replaceUnderscoresWithSpaces: req.body.replaceUnderscoresWithSpaces !== 'false'
    };

    const file = req.file;

    if (!file) {
        throw new ValidationError("No file has been uploaded");
    }

    const parentNote = becca.getNote(parentNoteId);

    if (!parentNote) {
        throw new NotFoundError(`Note '${parentNoteId}' doesn't exist.`);
    }

    const extension = path.extname(file.originalname).toLowerCase();

    // running all the event handlers on imported notes (and attributes) is slow
    // and may produce unintended consequences
    cls.disableEntityEvents();

    // eliminate flickering during import
    cls.ignoreEntityChangeIds();

    let note; // typically root of the import - client can show it after finishing the import

    const taskContext = TaskContext.getInstance(taskId, 'import', options);

    try {
        if (extension === '.zip' && options.explodeArchives) {
            note = await zipImportService.importZip(taskContext, file.buffer, parentNote);
        } else if (extension === '.opml' && options.explodeArchives) {
            note = await opmlImportService.importOpml(taskContext, file.buffer, parentNote);
        } else if (extension === '.enex' && options.explodeArchives) {
            note = await enexImportService.importEnex(taskContext, file, parentNote);
        } else {
            note = await singleImportService.importSingleFile(taskContext, file, parentNote);
        }
    }
    catch (e) {
        const message = `Import failed with following error: '${e.message}'. More details might be in the logs.`;
        taskContext.reportError(message);

        log.error(message + e.stack);

        return [500, message];
    }

    if (last === "true") {
        // small timeout to avoid race condition (message is received before the transaction is committed)
        setTimeout(() => taskContext.taskSucceeded({
            parentNoteId: parentNoteId,
            importedNoteId: note.noteId
        }), 1000);
    }

    // import has deactivated note events so becca is not updated
    // instead we force it to reload (can be async)

    beccaLoader.load();

    return note.getPojo();
}

module.exports = {
    importToBranch
};
