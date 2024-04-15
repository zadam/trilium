"use strict";

import noteService = require('../../services/notes');
import eraseService = require('../../services/erase');
import treeService = require('../../services/tree');
import sql = require('../../services/sql');
import utils = require('../../services/utils');
import log = require('../../services/log');
import TaskContext = require('../../services/task_context');
import becca = require('../../becca/becca');
import ValidationError = require('../../errors/validation_error');
import blobService = require('../../services/blob');
import { Request } from 'express';
import BBranch = require('../../becca/entities/bbranch');
import { AttributeRow } from '../../becca/entities/rows';

function getNote(req: Request) {
    return becca.getNoteOrThrow(req.params.noteId);
}

function getNoteBlob(req: Request) {
    return blobService.getBlobPojo('notes', req.params.noteId);
}

function getNoteMetadata(req: Request) {
    const note = becca.getNoteOrThrow(req.params.noteId);

    return {
        dateCreated: note.dateCreated,
        utcDateCreated: note.utcDateCreated,
        dateModified: note.dateModified,
        utcDateModified: note.utcDateModified,
    };
}

function createNote(req: Request) {
    const params = Object.assign({}, req.body); // clone
    params.parentNoteId = req.params.parentNoteId;

    const { target, targetBranchId } = req.query;

    if (target !== "into" && target !== "after") {
        throw new ValidationError("Invalid target type.");
    }

    if (targetBranchId && typeof targetBranchId !== "string") {
        throw new ValidationError("Missing or incorrect type for target branch ID.");
    }

    const { note, branch } = noteService.createNewNoteWithTarget(target, targetBranchId, params);

    return {
        note,
        branch
    };
}

function updateNoteData(req: Request) {
    const {content, attachments} = req.body;
    const {noteId} = req.params;

    return noteService.updateNoteData(noteId, content, attachments);
}

function deleteNote(req: Request) {
    const noteId = req.params.noteId;
    const taskId = req.query.taskId;
    const eraseNotes = req.query.eraseNotes === 'true';
    const last = req.query.last === 'true';

    // note how deleteId is separate from taskId - single taskId produces separate deleteId for each "top level" deleted note
    const deleteId = utils.randomString(10);

    const note = becca.getNoteOrThrow(noteId);

    if (typeof taskId !== "string") {
        throw new ValidationError("Missing or incorrect type for task ID.");
    }
    const taskContext = TaskContext.getInstance(taskId, 'deleteNotes');

    note.deleteNote(deleteId, taskContext);

    if (eraseNotes) {
        eraseService.eraseNotesWithDeleteId(deleteId);
    }

    if (last) {
        taskContext.taskSucceeded();
    }
}

function undeleteNote(req: Request) {
    const taskContext = TaskContext.getInstance(utils.randomString(10), 'undeleteNotes');

    noteService.undeleteNote(req.params.noteId, taskContext);

    taskContext.taskSucceeded();
}

function sortChildNotes(req: Request) {
    const noteId = req.params.noteId;
    const {sortBy, sortDirection, foldersFirst, sortNatural, sortLocale} = req.body;

    log.info(`Sorting '${noteId}' children with ${sortBy} ${sortDirection}, foldersFirst=${foldersFirst}, sortNatural=${sortNatural}, sortLocale=${sortLocale}`);

    const reverse = sortDirection === 'desc';

    treeService.sortNotes(noteId, sortBy, reverse, foldersFirst, sortNatural, sortLocale);
}

function protectNote(req: Request) {
    const noteId = req.params.noteId;
    const note = becca.notes[noteId];
    const protect = !!parseInt(req.params.isProtected);
    const includingSubTree = !!parseInt(req.query?.subtree as string);

    const taskContext = new TaskContext(utils.randomString(10), 'protectNotes', {protect});

    noteService.protectNoteRecursively(note, protect, includingSubTree, taskContext);

    taskContext.taskSucceeded();
}

function setNoteTypeMime(req: Request) {
    // can't use [] destructuring because req.params is not iterable
    const {noteId} = req.params;
    const {type, mime} = req.body;

    const note = becca.getNoteOrThrow(noteId);
    note.type = type;
    note.mime = mime;
    note.save();
}

function changeTitle(req: Request) {
    const noteId = req.params.noteId;
    const title = req.body.title;

    const note = becca.getNoteOrThrow(noteId);

    if (!note.isContentAvailable()) {
        throw new ValidationError(`Note '${noteId}' is not available for change`);
    }

    const noteTitleChanged = note.title !== title;

    if (noteTitleChanged) {
        noteService.saveRevisionIfNeeded(note);
    }

    note.title = title;

    note.save();

    if (noteTitleChanged) {
        noteService.triggerNoteTitleChanged(note);
    }

    return note;
}

function duplicateSubtree(req: Request) {
    const {noteId, parentNoteId} = req.params;

    return noteService.duplicateSubtree(noteId, parentNoteId);
}

function eraseDeletedNotesNow() {
    eraseService.eraseDeletedNotesNow();
}

function eraseUnusedAttachmentsNow() {
    eraseService.eraseUnusedAttachmentsNow();
}

function getDeleteNotesPreview(req: Request) {
    const {branchIdsToDelete, deleteAllClones} = req.body;

    const noteIdsToBeDeleted = new Set<string>();
    const strongBranchCountToDelete: Record<string, number> = {}; // noteId => count

    function branchPreviewDeletion(branch: BBranch) {
        if (branch.isWeak || !branch.branchId) {
            return;
        }

        strongBranchCountToDelete[branch.branchId] = strongBranchCountToDelete[branch.branchId] || 0;
        strongBranchCountToDelete[branch.branchId]++;

        const note = branch.getNote();

        if (deleteAllClones || note.getStrongParentBranches().length <= strongBranchCountToDelete[branch.branchId]) {
            noteIdsToBeDeleted.add(note.noteId);

            for (const childBranch of note.getChildBranches()) {
                branchPreviewDeletion(childBranch);
            }
        }
    }

    for (const branchId of branchIdsToDelete) {
        const branch = becca.getBranch(branchId);

        if (!branch) {
            log.error(`Branch ${branchId} was not found and delete preview can't be calculated for this note.`);

            continue;
        }

        branchPreviewDeletion(branch);
    }

    let brokenRelations: AttributeRow[] = [];

    if (noteIdsToBeDeleted.size > 0) {
        sql.fillParamList(noteIdsToBeDeleted);

        // FIXME: No need to do this in database, can be done with becca data
        brokenRelations = sql.getRows<AttributeRow>(`
            SELECT attr.noteId, attr.name, attr.value
            FROM attributes attr
                     JOIN param_list ON param_list.paramId = attr.value
            WHERE attr.isDeleted = 0
              AND attr.type = 'relation'`).filter(attr => attr.noteId && !noteIdsToBeDeleted.has(attr.noteId));
    }

    return {
        noteIdsToBeDeleted: Array.from(noteIdsToBeDeleted),
        brokenRelations
    };
}

function forceSaveRevision(req: Request) {
    const {noteId} = req.params;
    const note = becca.getNoteOrThrow(noteId);

    if (!note.isContentAvailable()) {
        throw new ValidationError(`Note revision of a protected note cannot be created outside of a protected session.`);
    }

    note.saveRevision();
}

function convertNoteToAttachment(req: Request) {
    const {noteId} = req.params;
    const note = becca.getNoteOrThrow(noteId);

    return {
        attachment: note.convertToParentAttachment()
    };
}

export = {
    getNote,
    getNoteBlob,
    getNoteMetadata,
    updateNoteData,
    deleteNote,
    undeleteNote,
    createNote,
    sortChildNotes,
    protectNote,
    setNoteTypeMime,
    changeTitle,
    duplicateSubtree,
    eraseDeletedNotesNow,
    eraseUnusedAttachmentsNow,
    getDeleteNotesPreview,
    forceSaveRevision,
    convertNoteToAttachment
};
