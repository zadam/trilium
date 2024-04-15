"use strict";

import becca = require('../../becca/becca');
import log = require('../../services/log');
import NotFoundError = require('../../errors/not_found_error');
import { Request } from 'express';
import BNote = require('../../becca/entities/bnote');

function getNotesAndBranchesAndAttributes(_noteIds: string[] | Set<string>) {
    const noteIds = new Set(_noteIds);
    const collectedNoteIds = new Set<string>();
    const collectedAttributeIds = new Set<string>();
    const collectedBranchIds = new Set<string>();

    function collectEntityIds(note?: BNote) {
        if (!note || collectedNoteIds.has(note.noteId)) {
            return;
        }

        collectedNoteIds.add(note.noteId);

        for (const branch of note.getParentBranches()) {
            if (branch.branchId) {
                collectedBranchIds.add(branch.branchId);
            }

            collectEntityIds(branch.parentNote);
        }

        for (const childNote of note.children) {
            const childBranch = becca.getBranchFromChildAndParent(childNote.noteId, note.noteId);
            if (childBranch && childBranch.branchId) {
                collectedBranchIds.add(childBranch.branchId);
            }
        }

        for (const attr of note.ownedAttributes) {
            collectedAttributeIds.add(attr.attributeId);

            if (attr.type === 'relation' && ['template', 'inherit'].includes(attr.name) && attr.targetNote) {
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
            mime: note.mime,
            blobId: note.blobId
        });
    }

    const branches = [];

    if (noteIds.has('root')) {
        branches.push({
            branchId: 'none_root',
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

function getTree(req: Request) {
    const subTreeNoteId = typeof req.query.subTreeNoteId === "string" ? req.query.subTreeNoteId : 'root';
    const collectedNoteIds = new Set<string>([subTreeNoteId]);

    function collect(parentNote: BNote) {
        if (!parentNote) {
            console.trace(parentNote);
        }

        for (const childNote of parentNote.children) {
            collectedNoteIds.add(childNote.noteId);

            const childBranch = becca.getBranchFromChildAndParent(childNote.noteId, parentNote.noteId);

            if (childBranch?.isExpanded) {
                collect(childBranch.childNote);
            }
        }
    }

    if (!(subTreeNoteId in becca.notes)) {
        throw new NotFoundError(`Note '${subTreeNoteId}' not found in the cache`);
    }

    collect(becca.notes[subTreeNoteId]);

    return getNotesAndBranchesAndAttributes(collectedNoteIds);
}

function load(req: Request) {
    return getNotesAndBranchesAndAttributes(req.body.noteIds);
}

export = {
    getTree,
    load
};
