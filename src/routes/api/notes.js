"use strict";

const noteService = require('../../services/notes');
const treeService = require('../../services/tree');
const repository = require('../../services/repository');

async function getNote(req) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, "Note " + noteId + " has not been found."];
    }

    if (note.type === 'file' || note.type === 'image') {
        // no need to transfer (potentially large) file/image payload for this request
        note.content = null;
    }

    return note;
}

async function getChildren(req) {
    const parentNoteId = req.params.parentNoteId;
    const parentNote = await repository.getNote(parentNoteId);

    if (!parentNote) {
        return [404, `Note ${parentNoteId} has not been found.`];
    }

    const ret = [];

    for (const childNote of await parentNote.getChildNotes()) {
        ret.push({
            noteId: childNote.noteId,
            title: childNote.title,
            relations: (await childNote.getRelations()).map(relation => { return {
                attributeId: relation.attributeId,
                name: relation.name,
                targetNoteId: relation.value
            }; })
        });
    }

    return ret;
}

async function createNote(req) {
    const parentNoteId = req.params.parentNoteId;
    const newNote = req.body;

    const { note, branch } = await noteService.createNewNote(parentNoteId, newNote, req);

    note.cssClass = (await note.getLabels("cssClass")).map(label => label.value).join(" ");

    return {
        note,
        branch
    };
}

async function updateNote(req) {
    const note = req.body;
    const noteId = req.params.noteId;

    await noteService.updateNote(noteId, note);
}

async function sortNotes(req) {
    const noteId = req.params.noteId;

    await treeService.sortNotesAlphabetically(noteId);
}

async function protectSubtree(req) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);
    const protect = !!parseInt(req.params.isProtected);

    await noteService.protectNoteRecursively(note, protect);
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
        noteTitles: {},
        relations: []
    };

    if (noteIds.length === 0) {
        return resp;
    }

    const questionMarks = noteIds.map(noteId => '?').join(',');

    (await repository.getEntities(`SELECT * FROM notes WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds))
        .forEach(note => resp.noteTitles[note.noteId] = note.title);

    // FIXME: this actually doesn't take into account inherited relations! But maybe it is better this way?
    resp.relations = (await repository.getEntities(`SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'relation' AND noteId IN (${questionMarks})`, noteIds))
        .map(relation => { return {
            attributeId: relation.attributeId,
            sourceNoteId: relation.noteId,
            targetNoteId: relation.value,
            name: relation.name
        }; })
        // both sourceNoteId and targetNoteId has to be in the included notes, but source was already checked in the SQL query
        .filter(relation => noteIds.includes(relation.targetNoteId));

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

    note.title = title;

    await note.save();
}

module.exports = {
    getNote,
    updateNote,
    createNote,
    sortNotes,
    protectSubtree,
    setNoteTypeMime,
    getChildren,
    getRelationMap,
    changeTitle
};