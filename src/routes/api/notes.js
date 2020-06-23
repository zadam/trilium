"use strict";

const noteService = require('../../services/notes');
const treeService = require('../../services/tree');
const repository = require('../../services/repository');
const utils = require('../../services/utils');
const TaskContext = require('../../services/task_context');

async function getNote(req) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, "Note " + noteId + " has not been found."];
    }

    if (note.isStringNote()) {
        note.content = await note.getContent();

        if (note.type === 'file') {
            note.content = note.content.substr(0, 10000);
        }
    }

    return note;
}

async function createNote(req) {
    const params = Object.assign({}, req.body); // clone
    params.parentNoteId = req.params.parentNoteId;

    const { target, targetBranchId } = req.query;

    const { note, branch } = await noteService.createNewNoteWithTarget(target, targetBranchId, params);

    return {
        note,
        branch
    };
}

async function updateNote(req) {
    const note = req.body;
    const noteId = req.params.noteId;

    return await noteService.updateNote(noteId, note);
}

async function deleteNote(req) {
    const noteId = req.params.noteId;
    const taskId = req.query.taskId;
    const last = req.query.last === 'true';

    // note how deleteId is separate from taskId - single taskId produces separate deleteId for each "top level" deleted note
    const deleteId = utils.randomString(10);

    const note = await repository.getNote(noteId);

    const taskContext = TaskContext.getInstance(taskId, 'delete-notes');

    for (const branch of await note.getBranches()) {
        await noteService.deleteBranch(branch, deleteId, taskContext);
    }

    if (last) {
        await taskContext.taskSucceeded();
    }
}

async function undeleteNote(req) {
    const note = await repository.getNote(req.params.noteId);

    const taskContext = TaskContext.getInstance(utils.randomString(10), 'undelete-notes');

    await noteService.undeleteNote(note, note.deleteId, taskContext);

    await taskContext.taskSucceeded();
}

async function sortNotes(req) {
    const noteId = req.params.noteId;

    await treeService.sortNotesAlphabetically(noteId);
}

async function protectNote(req) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);
    const protect = !!parseInt(req.params.isProtected);
    const includingSubTree = !!parseInt(req.query.subtree);

    const taskContext = new TaskContext(utils.randomString(10), 'protect-notes', {protect});

    await noteService.protectNoteRecursively(note, protect, includingSubTree, taskContext);

    taskContext.taskSucceeded();
}

async function setNoteTypeMime(req) {
    // can't use [] destructuring because req.params is not iterable
    const noteId = req.params[0];
    const type = req.params[1];
    const mime = req.params[2];

    const note = await repository.getNote(noteId);
    note.type = type;
    note.mime = mime;
    await note.save();
}

async function getRelationMap(req) {
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

    const notes = await repository.getEntities(`SELECT * FROM notes WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds);

    for (const note of notes) {
        resp.noteTitles[note.noteId] = note.title;

        resp.relations = resp.relations.concat((await note.getRelations())
            .filter(relation => noteIds.includes(relation.value))
            .map(relation => ({
                attributeId: relation.attributeId,
                sourceNoteId: relation.noteId,
                targetNoteId: relation.value,
                name: relation.name
            })));

        for (const relationDefinition of await note.getRelationDefinitions()) {
            if (relationDefinition.value.inverseRelation) {
                resp.inverseRelations[relationDefinition.name] = relationDefinition.value.inverseRelation;
            }
        }
    }

    return resp;
}

async function changeTitle(req) {
    const noteId = req.params.noteId;
    const title = req.body.title;

    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} has not been found`];
    }

    if (!note.isContentAvailable) {
        return [400, `Note ${noteId} is not available for change`];
    }

    const noteTitleChanged = note.title !== title;

    note.title = title;

    await note.save();

    if (noteTitleChanged) {
        await noteService.triggerNoteTitleChanged(note);
    }

    return note;
}

async function duplicateNote(req) {
    const {noteId, parentNoteId} = req.params;

    return await noteService.duplicateNote(noteId, parentNoteId);
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
