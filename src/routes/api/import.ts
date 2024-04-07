"use strict";

import enexImportService = require('../../services/import/enex');
import opmlImportService = require('../../services/import/opml');
import zipImportService = require('../../services/import/zip');
import singleImportService = require('../../services/import/single');
import cls = require('../../services/cls');
import path = require('path');
import becca = require('../../becca/becca');
import beccaLoader = require('../../becca/becca_loader');
import log = require('../../services/log');
import TaskContext = require('../../services/task_context');
import ValidationError = require('../../errors/validation_error');
import { Request } from 'express';
import BNote = require('../../becca/entities/bnote');
import { AppRequest } from '../route-interface';

async function importNotesToBranch(req: AppRequest) {
    const { parentNoteId } = req.params;
    const { taskId, last } = req.body;

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

    let note: BNote | null; // typically root of the import - client can show it after finishing the import

    const taskContext = TaskContext.getInstance(taskId, 'importNotes', options);

    try {
        if (extension === '.zip' && options.explodeArchives && typeof file.buffer !== "string") {
            note = await zipImportService.importZip(taskContext, file.buffer, parentNote);
        } else if (extension === '.opml' && options.explodeArchives) {
            const importResult = await opmlImportService.importOpml(taskContext, file.buffer, parentNote);
            if (!Array.isArray(importResult)) {
                note = importResult;
            } else {
                return importResult;
            }
        } else if (extension === '.enex' && options.explodeArchives) {
            const importResult = await enexImportService.importEnex(taskContext, file, parentNote);
            if (!Array.isArray(importResult)) {
                note = importResult;
            } else {
                return importResult;
            }
        } else {
            note = await singleImportService.importSingleFile(taskContext, file, parentNote);
        }
    }
    catch (e: any) {
        const message = `Import failed with following error: '${e.message}'. More details might be in the logs.`;
        taskContext.reportError(message);

        log.error(message + e.stack);

        return [500, message];
    }

    if (!note) {
        return [500, "No note was generated as a result of the import."];
    }

    if (last === "true") {
        // small timeout to avoid race condition (the message is received before the transaction is committed)
        setTimeout(() => taskContext.taskSucceeded({
            parentNoteId: parentNoteId,
            importedNoteId: note?.noteId
        }), 1000);
    }

    // import has deactivated note events so becca is not updated, instead we force it to reload
    beccaLoader.load();

    return note.getPojo();
}

async function importAttachmentsToNote(req: AppRequest) {
    const { parentNoteId } = req.params;
    const { taskId, last } = req.body;

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
    catch (e: any) {
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

export = {
    importNotesToBranch,
    importAttachmentsToNote
};
