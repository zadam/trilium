"use strict";

const becca = require("../../becca/becca");

function getRelations(noteId) {
    const note = becca.getNote(noteId);

    if (!note) {
        throw new Error(noteId);
    }

    const allRelations = note.getOwnedRelations().concat(note.getTargetRelations());

    return allRelations.filter(rel => {
        if (rel.name === 'relationMapLink' || rel.name === 'template') {
            return false;
        }
        else if (rel.name === 'imageLink') {
            const parentNote = becca.getNote(rel.noteId);

            return !parentNote.getChildNotes().find(childNote => childNote.noteId === rel.value);
        }
        else {
            return true;
        }
    });
}

function collectRelations(noteId, relations, depth) {
    if (depth === 0) {
        return;
    }

    for (const relation of getRelations(noteId)) {
        if (!relations.has(relation)) {
            if (!relation.value) {
                continue;
            }

            relations.add(relation);

            if (relation.noteId !== noteId) {
                collectRelations(relation.noteId, relations, depth - 1);
            } else if (relation.value !== noteId) {
                collectRelations(relation.value, relations, depth - 1);
            }
        }
    }
}

function getLinkMap(req) {
    const {noteId} = req.params;
    const {maxDepth} = req.body;

    let relations = new Set();

    collectRelations(noteId, relations, maxDepth);

    relations = Array.from(relations);

    const noteIds = new Set(relations.map(rel => rel.noteId)
        .concat(relations.map(rel => rel.targetNoteId))
        .concat([noteId]));

    const noteIdToLinkCountMap = {};

    for (const noteId of noteIds) {
        noteIdToLinkCountMap[noteId] = getRelations(noteId).length;
    }

    return {
        noteIdToLinkCountMap,
        links: Array.from(relations).map(rel => ({
            id: rel.noteId + "-" + rel.name + "-" + rel.value,
            sourceNoteId: rel.noteId,
            targetNoteId: rel.value,
            name: rel.name
        }))
    };
}

function buildDescendantCountMap() {
    const noteIdToCountMap = {};

    function getCount(noteId) {
        if (!(noteId in noteIdToCountMap)) {
            const note = becca.getNote(noteId);

            noteIdToCountMap[noteId] = note.children.length;

            for (const child of note.children) {
                noteIdToCountMap[noteId] += getCount(child.noteId);
            }
        }

        return noteIdToCountMap[noteId];
    }

    getCount('root');

    return noteIdToCountMap;
}

function getGlobalLinkMap() {
    const noteIds = new Set();

    const notes = Object.values(becca.notes)
        .filter(note => !note.isArchived)
        .map(note => [
            note.noteId,
            note.isContentAvailable() ? note.title : '[protected]',
            note.type
        ]);

    notes.forEach(([noteId]) => noteIds.add(noteId));

    const links = Object.values(becca.attributes).filter(rel => {
        if (rel.type !== 'relation' || rel.name === 'relationMapLink' || rel.name === 'template') {
            return false;
        }
        else if (!noteIds.has(rel.noteId) || !noteIds.has(rel.value)) {
            return false;
        }
        else if (rel.name === 'imageLink') {
            const parentNote = becca.getNote(rel.noteId);

            return !parentNote.getChildNotes().find(childNote => childNote.noteId === rel.value);
        }
        else {
            return true;
        }
    })
        .map(rel => ({
        id: rel.noteId + "-" + rel.name + "-" + rel.value,
        sourceNoteId: rel.noteId,
        targetNoteId: rel.value,
        name: rel.name
    }));

    return {
        notes: notes,
        noteIdToDescendantCountMap: buildDescendantCountMap(),
        links: links
    };
}

function getGlobalTreeMap() {
    const noteIds = new Set();

    const notes = Object.values(becca.notes)
        .filter(note => !note.isArchived)
        .map(note => [
            note.noteId,
            note.isContentAvailable() ? note.title : '[protected]',
            note.type
        ]);

    notes.forEach(([noteId]) => noteIds.add(noteId));

    const links = [];

    for (const branch of Object.values(becca.branches)) {
        if (!noteIds.has(branch.parentNoteId) || !noteIds.has(branch.noteId)) {
            continue;
        }

        links.push({
            id: branch.branchId,
            sourceNoteId: branch.parentNoteId,
            targetNoteId: branch.noteId,
            name: 'branch'
        });
    }

    return {
        notes: notes,
        noteIdToDescendantCountMap: buildDescendantCountMap(),
        links: links
    };
}

module.exports = {
    getLinkMap,
    getGlobalLinkMap,
    getGlobalTreeMap
};
