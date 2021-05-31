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
                collectRelations(relation.noteId, relations, depth--);
            } else if (relation.value !== noteId) {
                collectRelations(relation.value, relations, depth--);
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
            sourceNoteId: rel.noteId,
            targetNoteId: rel.value,
            name: rel.name
        }))
    };
}

module.exports = {
    getLinkMap
};
