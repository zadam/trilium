"use strict";

const noteService = require('../../services/notes');
const treeService = require('../../services/tree');
const repository = require('../../services/repository');
const utils = require('../../services/utils');
const TaskContext = require('../../services/task_context');

function getNote(req) {
    const noteId = req.params.noteId;
    const note = repository.getNote(noteId);

    if (!note) {
        return [404, "Note " + noteId + " has not been found."];
    }

    if (note.isStringNote()) {
        note.content = note.getContent();

        if (note.type === 'file' && note.content.length > 10000) {
            note.content = note.content.substr(0, 10000)
                + `\r\n\r\n... and ${note.content.length - 10000} more characters.`;
        }
    }

    const contentMetadata = note.getContentMetadata();

    note.contentLength = contentMetadata.contentLength;

    note.combinedUtcDateModified = note.utcDateModified > contentMetadata.utcDateModified ? note.utcDateModified : contentMetadata.utcDateModified;
    note.combinedDateModified = note.utcDateModified > contentMetadata.utcDateModified ? note.dateModified : contentMetadata.dateModified;

    return note;
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

function updateNote(req) {
    const note = req.body;
    const noteId = req.params.noteId;

    return noteService.updateNote(noteId, note);
}

function deleteNote(req) {
    const noteId = req.params.noteId;
    const taskId = req.query.taskId;
    const last = req.query.last === 'true';

    // note how deleteId is separate from taskId - single taskId produces separate deleteId for each "top level" deleted note
    const deleteId = utils.randomString(10);

    const note = repository.getNote(noteId);

    const taskContext = TaskContext.getInstance(taskId, 'delete-notes');

    for (const branch of note.getBranches()) {
        noteService.deleteBranch(branch, deleteId, taskContext);
    }

    if (last) {
        taskContext.taskSucceeded();
    }
}

function undeleteNote(req) {
    const note = repository.getNote(req.params.noteId);

    const taskContext = TaskContext.getInstance(utils.randomString(10), 'undelete-notes');

    noteService.undeleteNote(note, note.deleteId, taskContext);

    taskContext.taskSucceeded();
}

function sortNotes(req) {
    const noteId = req.params.noteId;

    treeService.sortNotesAlphabetically(noteId);
}

function protectNote(req) {
    const noteId = req.params.noteId;
    const note = repository.getNote(noteId);
    const protect = !!parseInt(req.params.isProtected);
    const includingSubTree = !!parseInt(req.query.subtree);

    const taskContext = new TaskContext(utils.randomString(10), 'protect-notes', {protect});

    noteService.protectNoteRecursively(note, protect, includingSubTree, taskContext);

    taskContext.taskSucceeded();
}

function setNoteTypeMime(req) {
    // can't use [] destructuring because req.params is not iterable
    const noteId = req.params[0];
    const type = req.params[1];
    const mime = req.params[2];

    const note = repository.getNote(noteId);
    note.type = type;
    note.mime = mime;
    note.save();
}

function getRelationMap(req) {
    const noteIds = req.body.noteIds;
    const resp = {
        // noteId => title
        noteTitles: {},
        relations: [],
        // relation name => inverse relation name
        inverseRelations: {
            'internalLink': 'internalLink'
        }
    };

    if (noteIds.length === 0) {
        return resp;
    }

    const questionMarks = noteIds.map(noteId => '?').join(',');

    const notes = repository.getEntities(`SELECT * FROM notes WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds);

    for (const note of notes) {
        resp.noteTitles[note.noteId] = note.title;

        resp.relations = resp.relations.concat(note.getRelations()
            .filter(relation => noteIds.includes(relation.value))
            .map(relation => ({
                attributeId: relation.attributeId,
                sourceNoteId: relation.noteId,
                targetNoteId: relation.value,
                name: relation.name
            })));

        for (const relationDefinition of note.getRelationDefinitions()) {
            const def = relationDefinition.getDefinition();

            if (def.inverseRelation) {
                resp.inverseRelations[relationDefinition.getDefinedName()] = def.inverseRelation;
            }
        }
    }

    return resp;
}

function changeTitle(req) {
    const noteId = req.params.noteId;
    const title = req.body.title;

    const note = repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} has not been found`];
    }

    if (!note.isContentAvailable) {
        return [400, `Note ${noteId} is not available for change`];
    }

    const noteTitleChanged = note.title !== title;

    note.title = title;

    note.save();

    if (noteTitleChanged) {
        noteService.triggerNoteTitleChanged(note);
    }

    return note;
}

function duplicateNote(req) {
    const {noteId, parentNoteId} = req.params;

    return noteService.duplicateNote(noteId, parentNoteId);
}

module.exports = {
    getNote,
    updateNote,
    deleteNote,
    undeleteNote,
    createNote,
    sortNotes,
    protectNote,
    setNoteTypeMime,
    getRelationMap,
    changeTitle,
    duplicateNote
};
