"use strict";

const noteService = require('../../services/notes.js');
const eraseService = require('../../services/erase.js');
const treeService = require('../../services/tree.js');
const sql = require('../../services/sql.js');
const utils = require('../../services/utils.js');
const log = require('../../services/log.js');
const TaskContext = require('../../services/task_context.js');
const becca = require('../../becca/becca.js');
const ValidationError = require('../../errors/validation_error.js');
const blobService = require('../../services/blob.js');

function getNote(req) {
    return becca.getNoteOrThrow(req.params.noteId);
}

function getNoteBlob(req) {
    return blobService.getBlobPojo('notes', req.params.noteId);
}

function getNoteMetadata(req) {
    const note = becca.getNoteOrThrow(req.params.noteId);

    return {
        dateCreated: note.dateCreated,
        utcDateCreated: note.utcDateCreated,
        dateModified: note.dateModified,
        utcDateModified: note.utcDateModified,
    };
}

function createNote(req) {
    const params = Object.assign({}, req.body); // clone
    params.parentNoteId = req.params.parentNoteId;

    const { target, targetBranchId } = req.query;

    const { note, branch } = noteService.createNewNoteWithTarget(target, targetBranchId, params);

    return {
        note,
        branch
    };
}

function updateNoteData(req) {
    const {content, attachments} = req.body;
    const {noteId} = req.params;

    return noteService.updateNoteData(noteId, content, attachments);
}

function deleteNote(req) {
    const noteId = req.params.noteId;
    const taskId = req.query.taskId;
    const eraseNotes = req.query.eraseNotes === 'true';
    const last = req.query.last === 'true';

    // note how deleteId is separate from taskId - single taskId produces separate deleteId for each "top level" deleted note
    const deleteId = utils.randomString(10);

    const note = becca.getNote(noteId);

    const taskContext = TaskContext.getInstance(taskId, 'deleteNotes');

    note.deleteNote(deleteId, taskContext);

    if (eraseNotes) {
        eraseService.eraseNotesWithDeleteId(deleteId);
    }

    if (last) {
        taskContext.taskSucceeded();
    }
}

function undeleteNote(req) {
    const taskContext = TaskContext.getInstance(utils.randomString(10), 'undeleteNotes');

    noteService.undeleteNote(req.params.noteId, taskContext);

    taskContext.taskSucceeded();
}

function sortChildNotes(req) {
    const noteId = req.params.noteId;
    const {sortBy, sortDirection, foldersFirst, sortNatural, sortLocale} = req.body;

    log.info(`Sorting '${noteId}' children with ${sortBy} ${sortDirection}, foldersFirst=${foldersFirst}, sortNatural=${sortNatural}, sortLocale=${sortLocale}`);

    const reverse = sortDirection === 'desc';

    treeService.sortNotes(noteId, sortBy, reverse, foldersFirst, sortNatural, sortLocale);
}

function protectNote(req) {
    const noteId = req.params.noteId;
    const note = becca.notes[noteId];
    const protect = !!parseInt(req.params.isProtected);
    const includingSubTree = !!parseInt(req.query.subtree);

    const taskContext = new TaskContext(utils.randomString(10), 'protectNotes', {protect});

    noteService.protectNoteRecursively(note, protect, includingSubTree, taskContext);

    taskContext.taskSucceeded();
}

function setNoteTypeMime(req) {
    // can't use [] destructuring because req.params is not iterable
    const {noteId} = req.params;
    const {type, mime} = req.body;

    const note = becca.getNote(noteId);
    note.type = type;
    note.mime = mime;
    note.save();
}

function changeTitle(req) {
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

function duplicateSubtree(req) {
    const {noteId, parentNoteId} = req.params;

    return noteService.duplicateSubtree(noteId, parentNoteId);
}

function eraseDeletedNotesNow() {
    eraseService.eraseDeletedNotesNow();
}

function eraseUnusedAttachmentsNow() {
    eraseService.eraseUnusedAttachmentsNow();
}

function getDeleteNotesPreview(req) {
    const {branchIdsToDelete, deleteAllClones} = req.body;

    const noteIdsToBeDeleted = new Set();
    const strongBranchCountToDelete = {}; // noteId => count (integer)

    function branchPreviewDeletion(branch) {
        if (branch.isWeak) {
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

    let brokenRelations = [];

    if (noteIdsToBeDeleted.size > 0) {
        sql.fillParamList(noteIdsToBeDeleted);

        // FIXME: No need to do this in database, can be done with becca data
        brokenRelations = sql.getRows(`
            SELECT attr.noteId, attr.name, attr.value
            FROM attributes attr
                     JOIN param_list ON param_list.paramId = attr.value
            WHERE attr.isDeleted = 0
              AND attr.type = 'relation'`).filter(attr => !noteIdsToBeDeleted.has(attr.noteId));
    }

    return {
        noteIdsToBeDeleted: Array.from(noteIdsToBeDeleted),
        brokenRelations
    };
}

function forceSaveRevision(req) {
    const {noteId} = req.params;
    const note = becca.getNoteOrThrow(noteId);

    if (!note.isContentAvailable()) {
        throw new ValidationError(`Note revision of a protected note cannot be created outside of a protected session.`);
    }

    note.saveRevision();
}

function convertNoteToAttachment(req) {
    const {noteId} = req.params;
    const note = becca.getNoteOrThrow(noteId);

    return {
        attachment: note.convertToParentAttachment()
    };
}

module.exports = {
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
