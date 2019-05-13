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

    if (note.isStringNote()) {
        await note.getContent();

        if (note.type === 'file') {
            note.content = note.content.substr(0, 10000);
        }
    }

    note.cssClass = (await note.getLabels("cssClass")).map(label => label.value).join(" ");

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

async function deleteNote(req) {
    const noteId = req.params.noteId;

    const note = await repository.getNote(noteId);

    for (const branch of await note.getBranches()) {
        await noteService.deleteNote(branch);
    }
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
        // noteId => title
        noteTitles: {},
        relations: [],
        // relation name => inverse relation name
        inverseRelations: {},
        links: []
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
            .map(relation => { return {
                attributeId: relation.attributeId,
                sourceNoteId: relation.noteId,
                targetNoteId: relation.value,
                name: relation.name
            }; }));

        for (const relationDefinition of await note.getRelationDefinitions()) {
            if (relationDefinition.value.inverseRelation) {
                resp.inverseRelations[relationDefinition.name] = relationDefinition.value.inverseRelation;
            }
        }
    }

    resp.links = (await repository.getEntities(`SELECT * FROM links WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds))
        .filter(link => noteIds.includes(link.targetNoteId))
        .map(link => {
            return {
                linkId: link.linkId,
                sourceNoteId: link.noteId,
                targetNoteId: link.targetNoteId
            }
        });

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
    deleteNote,
    createNote,
    sortNotes,
    protectSubtree,
    setNoteTypeMime,
    getChildren,
    getRelationMap,
    changeTitle
};