"use strict";

const noteCache = require('../../services/note_cache/note_cache');

function getNotesAndBranchesAndAttributes(noteIds) {
    noteIds = new Set(noteIds);
    const collectedNoteIds = new Set();
    const collectedAttributeIds = new Set();
    const collectedBranchIds = new Set();

    function collectEntityIds(note) {
        if (collectedNoteIds.has(note.noteId)) {
            return;
        }

        collectedNoteIds.add(note.noteId);

        for (const branch of note.parentBranches) {
            collectedBranchIds.add(branch.branchId);

            collectEntityIds(branch.parentNote);
        }

        for (const attr of note.ownedAttributes) {
            collectedAttributeIds.add(attr.attributeId);

            if (attr.type === 'relation' && attr.name === 'template') {
                collectEntityIds(attr.targetNote);
            }
        }
    }

    for (const noteId of noteIds) {
        const note = noteCache.notes[noteId];

        if (!note) {
            continue;
        }

        collectEntityIds(note);
    }

    const notes = [];

    for (const noteId of collectedNoteIds) {
        const note = noteCache.notes[noteId];

        notes.push({
            noteId: note.noteId,
            title: note.title,
            isProtected: note.isProtected,
            type: note.type,
            mime: note.mime,
            isDeleted: note.isDeleted
        });
    }

    const branches = [];

    if (noteIds.has('root')) {
        branches.push({
            branchId: 'root',
            noteId: 'root',
            parentNoteId: 'none',
            notePosition: 0,
            prefix: '',
            isExpanded: true
        });
    }

    for (const branchId of collectedBranchIds) {
        const branch = noteCache.branches[branchId];

        branches.push({
            branchId: branch.branchId,
            noteId: branch.noteId,
            parentNoteId: branch.parentNoteId,
            notePosition: branch.notePosition,
            prefix: branch.prefix,
            isExpanded: branch.isExpanded
        });
    }

    const attributes = [];

    for (const attributeId of collectedAttributeIds) {
        const attribute = noteCache.attributes[attributeId];

        attributes.push({
            attributeId: attribute.attributeId,
            noteId: attribute.noteId,
            type: attribute.type,
            name: attribute.name,
            value: attribute.value,
            position: attribute.position,
            isInheritable: attribute.isInheritable
        });
    }

    branches.sort((a, b) => a.notePosition - b.notePosition < 0 ? -1 : 1);
    attributes.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

    return {
        branches,
        notes,
        attributes
    };
}

function getTree(req) {
    const subTreeNoteId = req.query.subTreeNoteId || 'root';
    const collectedNoteIds = new Set(['root']);

    function collect(parentNote) {
        for (const childNote of parentNote.children || []) {
            collectedNoteIds.add(childNote.noteId);

            const childBranch = noteCache.getBranch(childNote.noteId, parentNote.noteId);

            if (childBranch.isExpanded) {
                collect(childBranch);
            }
        }
    }

    collect(noteCache.notes[subTreeNoteId]);

    return getNotesAndBranchesAndAttributes(collectedNoteIds);
}

function load(req) {
    return getNotesAndBranchesAndAttributes(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
