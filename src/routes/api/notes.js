"use strict";

const noteService = require('../../services/notes');
const treeService = require('../../services/tree');
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const log = require('../../services/log');
const TaskContext = require('../../services/task_context');
const becca = require("../../becca/becca");
const ValidationError = require("../../errors/validation_error");
const NotFoundError = require("../../errors/not_found_error");
const blobService = require("../../services/blob");

function getNote(req) {
    const note = becca.getNote(req.params.noteId);
    if (!note) {
        throw new NotFoundError(`Note '${req.params.noteId}' has not been found.`);
    }

    return note;
}

function getNoteBlob(req) {
    const preview = req.query.preview === 'true';

    return blobService.getBlobPojo('notes', req.params.noteId, { preview });
}

function getNoteMetadata(req) {
    const note = becca.getNote(req.params.noteId);
    if (!note) {
        throw new NotFoundError(`Note '${req.params.noteId}' has not been found.`);
    }

    const contentMetadata = note.getContentMetadata();

    return {
        dateCreated: note.dateCreated,
        combinedDateModified: note.utcDateModified > contentMetadata.utcDateModified ? note.dateModified : contentMetadata.dateModified
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
    const {content} = req.body;
    const {noteId} = req.params;

    return noteService.updateNoteData(noteId, content);
}

function deleteNote(req) {
    const noteId = req.params.noteId;
    const taskId = req.query.taskId;
    const eraseNotes = req.query.eraseNotes === 'true';
    const last = req.query.last === 'true';

    // note how deleteId is separate from taskId - single taskId produces separate deleteId for each "top level" deleted note
    const deleteId = utils.randomString(10);

    const note = becca.getNote(noteId);

    const taskContext = TaskContext.getInstance(taskId, 'delete-notes');

    note.deleteNote(deleteId, taskContext);

    if (eraseNotes) {
        noteService.eraseNotesWithDeleteId(deleteId);
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

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' has not been found`);
    }

    if (!note.isContentAvailable()) {
        throw new ValidationError(`Note '${noteId}' is not available for change`);
    }

    const noteTitleChanged = note.title !== title;

    if (noteTitleChanged) {
        noteService.saveNoteRevisionIfNeeded(note);
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
    noteService.eraseDeletedNotesNow();
}

function eraseUnusedAttachmentsNow() {
    noteService.eraseUnusedAttachmentsNow();
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

function forceSaveNoteRevision(req) {
    const {noteId} = req.params;
    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' not found.`);
    }

    if (!note.isContentAvailable()) {
        throw new ValidationError(`Note revision of a protected note cannot be created outside of a protected session.`);
    }

    note.saveNoteRevision();
}

function convertNoteToAttachment(req) {
    const {noteId} = req.params;
    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' not found.`);
    }

    return {
        attachment: note.convertToParentAttachment({ force: true })
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
    forceSaveNoteRevision,
    convertNoteToAttachment
};
