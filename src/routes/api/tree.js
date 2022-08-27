"use strict";

const becca = require('../../becca/becca');
const log = require('../../services/log');

function getNotesAndBranchesAndAttributes(noteIds) {
    noteIds = new Set(noteIds);
    const collectedNoteIds = new Set();
    const collectedAttributeIds = new Set();
    const collectedBranchIds = new Set();

    function collectEntityIds(note) {
        if (!note || collectedNoteIds.has(note.noteId)) {
            return;
        }

        collectedNoteIds.add(note.noteId);

        for (const branch of note.getParentBranches()) {
            collectedBranchIds.add(branch.branchId);

            collectEntityIds(branch.parentNote);
        }

        for (const childNote of note.children) {
            const childBranch = becca.getBranchFromChildAndParent(childNote.noteId, note.noteId);

            collectedBranchIds.add(childBranch.branchId);
        }

        for (const attr of note.ownedAttributes) {
            collectedAttributeIds.add(attr.attributeId);

            if (attr.type === 'relation' && attr.name === 'template' && attr.targetNote) {
                collectEntityIds(attr.targetNote);
            }
        }
    }

    for (const noteId of noteIds) {
        const note = becca.notes[noteId];

        if (!note) {
            continue;
        }

        collectEntityIds(note);
    }

    const notes = [];

    for (const noteId of collectedNoteIds) {
        const note = becca.notes[noteId];

        notes.push({
            noteId: note.noteId,
            title: note.getTitleOrProtected(),
            isProtected: note.isProtected,
            type: note.type,
            mime: note.mime
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
        const branch = becca.branches[branchId];

        if (!branch) {
            log.error(`Could not find branch for branchId=${branchId}`);
            continue;
        }

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
        const attribute = becca.attributes[attributeId];

        if (!attribute) {
            log.error(`Could not find attribute for attributeId=${attributeId}`);
            continue;
        }

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

    return {
        branches,
        notes,
        attributes
    };
}

function getTree(req) {
    const subTreeNoteId = req.query.subTreeNoteId || 'root';
    const collectedNoteIds = new Set([subTreeNoteId]);

    function collect(parentNote) {
        if (!parentNote) {
            console.trace(parentNote);
        }

        for (const childNote of parentNote.children) {
            collectedNoteIds.add(childNote.noteId);

            const childBranch = becca.getBranchFromChildAndParent(childNote.noteId, parentNote.noteId);

            if (childBranch.isExpanded) {
                collect(childBranch.childNote);
            }
        }
    }

    if (!(subTreeNoteId in becca.notes)) {
        return [404, `Note ${subTreeNoteId} not found in the cache`];
    }

    collect(becca.notes[subTreeNoteId]);

    return getNotesAndBranchesAndAttributes(collectedNoteIds);
}

function load(req) {
    return getNotesAndBranchesAndAttributes(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
