import enexImportService from '../../services/import/enex.js'
import opmlImportService from '../../services/import/opml.js'
import zipImportService from '../../services/import/zip.js'
import singleImportService from '../../services/import/single.js'
import cls from '../../services/cls.js'
import path from 'path';
import becca from '../../becca/becca.js'
import beccaLoader from '../../becca/becca_loader.js'
import log from '../../services/log.js'
import TaskContext from '../../services/task_context.js'
import ValidationError from '../../errors/validation_error.js'

async function importNotesToBranch(req) {
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

    const parentNote = becca.getNoteOrThrow(parentNoteId);

    const extension = path.extname(file.originalname).toLowerCase();

    // running all the event handlers on imported notes (and attributes) is slow
    // and may produce unintended consequences
    cls.disableEntityEvents();

    // eliminate flickering during import
    cls.ignoreEntityChangeIds();

    let note; // typically root of the import - client can show it after finishing the import

    const taskContext = TaskContext.getInstance(taskId, 'importNotes', options);

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
        // small timeout to avoid race condition (the message is received before the transaction is committed)
        setTimeout(() => taskContext.taskSucceeded({
            parentNoteId: parentNoteId,
            importedNoteId: note.noteId
        }), 1000);
    }

    // import has deactivated note events so becca is not updated, instead we force it to reload
    beccaLoader.load();

    return note.getPojo();
}

async function importAttachmentsToNote(req) {
    const {parentNoteId} = req.params;
    const {taskId, last} = req.body;

    const options = {
        shrinkImages: req.body.shrinkImages !== 'false',
    };

    const file = req.file;

    if (!file) {
        throw new ValidationError("No file has been uploaded");
    }

    const parentNote = becca.getNoteOrThrow(parentNoteId);
    const taskContext = TaskContext.getInstance(taskId, 'importAttachment', options);

    // unlike in note import, we let the events run, because a huge number of attachments is not likely

    try {
        await singleImportService.importAttachment(taskContext, file, parentNote);
    }
    catch (e) {
        const message = `Import failed with following error: '${e.message}'. More details might be in the logs.`;
        taskContext.reportError(message);

        log.error(message + e.stack);

        return [500, message];
    }

    if (last === "true") {
        // small timeout to avoid race condition (the message is received before the transaction is committed)
        setTimeout(() => taskContext.taskSucceeded({
            parentNoteId: parentNoteId
        }), 1000);
    }
}

export default {
    importNotesToBranch,
    importAttachmentsToNote
};
