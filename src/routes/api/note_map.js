"use strict";

const becca = require("../../becca/becca");

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

function getNeighbors(note, depth) {
    if (depth === 0) {
        return [];
    }

    const retNoteIds = [];

    function isIgnoredRelation(relation) {
        return ['relationMapLink', 'template', 'image'].includes(relation.name);
    }

    // forward links
    for (const relation of note.getRelations()) {
        if (isIgnoredRelation(relation)) {
            continue;
        }

        const targetNote = relation.getTargetNote();
        retNoteIds.push(targetNote.noteId);

        for (const noteId of getNeighbors(targetNote, depth - 1)) {
            retNoteIds.push(noteId);
        }
    }

    // backward links
    for (const relation of note.getTargetRelations()) {
        if (isIgnoredRelation(relation)) {
            continue;
        }

        const sourceNote = relation.getNote();
        retNoteIds.push(sourceNote.noteId);

        for (const noteId of getNeighbors(sourceNote, depth - 1)) {
            retNoteIds.push(noteId);
        }
    }

    return retNoteIds;
}

function getLinkMap(req) {
    const mapRootNote = becca.getNote(req.params.noteId);
    // if the map root itself has ignore (journal typically) then there wouldn't be anything to display so
    // we'll just ignore it
    const ignoreExcludeFromNoteMap = mapRootNote.hasLabel('excludeFromNoteMap');

    const noteIds = new Set(
        mapRootNote.getSubtreeNotes(false)
            .filter(note => ignoreExcludeFromNoteMap || !note.hasLabel('excludeFromNoteMap'))
            .map(note => note.noteId)
    );

    for (const noteId of getNeighbors(mapRootNote, 3)) {
        noteIds.add(noteId);
    }

    const notes = Array.from(noteIds).map(noteId => {
        const note = becca.getNote(noteId);

        return [
            note.noteId,
            note.isContentAvailable() ? note.title : '[protected]',
            note.type
        ];
    });

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

function getTreeMap(req) {
    const mapRootNote = becca.getNote(req.params.noteId);
    // if the map root itself has ignore (journal typically) then there wouldn't be anything to display so
    // we'll just ignore it
    const ignoreExcludeFromNoteMap = mapRootNote.hasLabel('excludeFromNoteMap');
    const noteIds = new Set();

    const notes = mapRootNote.getSubtreeNotes(false)
        .filter(note => ignoreExcludeFromNoteMap || !note.hasLabel('excludeFromNoteMap'))
        .filter(note => {
            if (note.type !== 'image' || note.getChildNotes().length > 0) {
                return true;
            }

            const imageLinkRelation = note.getTargetRelations().find(rel => rel.name === 'imageLink');

            if (!imageLinkRelation) {
                return true;
            }

            return !note.getParentNotes().find(parentNote => parentNote.noteId === imageLinkRelation.noteId);
        })
        .concat(...mapRootNote.getParentNotes())
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
            targetNoteId: branch.noteId
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
    getTreeMap
};
