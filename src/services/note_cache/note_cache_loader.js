"use strict";

const sql = require('../sql.js');
const eventService = require('../events.js');
const becca = require('./note_cache');
const sqlInit = require('../sql_init');
const log = require('../log');
const Note = require('./entities/note');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');

sqlInit.dbReady.then(() => {
    load();
});

function load() {
    const start = Date.now();
    becca.reset();

    for (const row of sql.iterateRows(`SELECT noteId, title, type, mime, isProtected, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes WHERE isDeleted = 0`, [])) {
        new Note(becca, row);
    }

    for (const row of sql.iterateRows(`SELECT branchId, noteId, parentNoteId, prefix, notePosition, isExpanded FROM branches WHERE isDeleted = 0`, [])) {
        const branch = new Branch(becca, row);
    }

    for (const row of sql.iterateRows(`SELECT attributeId, noteId, type, name, value, isInheritable, position FROM attributes WHERE isDeleted = 0`, [])) {
        new Attribute(becca, row);
    }

    becca.loaded = true;

    log.info(`Becca (note cache) load took ${Date.now() - start}ms`);
}

eventService.subscribe([eventService.ENTITY_CHANGED, eventService.ENTITY_DELETED, eventService.ENTITY_SYNCED],  ({entityName, entity}) => {
    // note that entity can also be just POJO without methods if coming from sync

    if (!becca.loaded) {
        return;
    }

    if (entityName === 'notes') {
        const {noteId} = entity;

        if (entity.isDeleted) {
            delete becca.notes[noteId];
        }
        else if (noteId in becca.notes) {
            becca.notes[noteId].update(entity);
        }
        else {
            const note = new Note(becca, entity);

            note.decrypt();
        }
    }
    else if (entityName === 'branches') {
        const {branchId, noteId, parentNoteId} = entity;
        const childNote = becca.notes[noteId];

        if (entity.isDeleted) {
            if (childNote) {
                childNote.parents = childNote.parents.filter(parent => parent.noteId !== parentNoteId);
                childNote.parentBranches = childNote.parentBranches.filter(branch => branch.branchId !== branchId);

                if (childNote.parents.length > 0) {
                    childNote.invalidateSubfrocas();
                }
            }

            const parentNote = becca.notes[parentNoteId];

            if (parentNote) {
                parentNote.children = parentNote.children.filter(child => child.noteId !== noteId);
            }

            delete becca.childParentToBranch[`${noteId}-${parentNoteId}`];
            delete becca.branches[branchId];
        }
        else if (branchId in becca.branches) {
            // only relevant properties which can change in a branch are prefix and isExpanded
            becca.branches[branchId].prefix = entity.prefix;
            becca.branches[branchId].isExpanded = entity.isExpanded;

            if (childNote) {
                childNote.flatTextCache = null;
            }
        }
        else {
            becca.branches[branchId] = new Branch(becca, entity);

            if (childNote) {
                childNote.resortParents();
            }
        }
    }
    else if (entityName === 'attributes') {
        const {attributeId, noteId} = entity;
        const note = becca.notes[noteId];
        const attr = becca.attributes[attributeId];

        if (entity.isDeleted) {
            if (note && attr) {
                // first invalidate and only then remove the attribute (otherwise invalidation wouldn't be complete)
                if (attr.isAffectingSubtree || note.isTemplate) {
                    note.invalidateSubfrocas();
                } else {
                    note.invalidateThisCache();
                }

                note.ownedAttributes = note.ownedAttributes.filter(attr => attr.attributeId !== attributeId);

                const targetNote = attr.targetNote;

                if (targetNote) {
                    targetNote.targetRelations = targetNote.targetRelations.filter(rel => rel.attributeId !== attributeId);
                }
            }

            delete becca.attributes[attributeId];

            if (attr) {
                const key = `${attr.type}-${attr.name.toLowerCase()}`;

                if (key in becca.attributeIndex) {
                    becca.attributeIndex[key] = becca.attributeIndex[key].filter(attr => attr.attributeId !== attributeId);
                }
            }
        }
        else if (attributeId in becca.attributes) {
            const attr = becca.attributes[attributeId];

            // attr name and isInheritable are immutable
            attr.value = entity.value;

            if (attr.isAffectingSubtree || note.isTemplate) {
                note.invalidateSubtreeFlatText();
            }
            else {
                note.invalidateThisCache();
            }
        }
        else {
            const attr = new Attribute(becca, entity);

            if (note) {
                if (attr.isAffectingSubtree || note.isTemplate) {
                    note.invalidateSubfrocas();
                }
                else {
                    note.invalidateThisCache();
                }
            }
        }
    }
    else if (entityName === 'note_reordering') {
        const parentNoteIds = new Set();

        for (const branchId in entity) {
            const branch = becca.branches[branchId];

            if (branch) {
                branch.notePosition = entity[branchId];

                parentNoteIds.add(branch.parentNoteId);
            }
        }
    }
});

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    try {
        becca.decryptProtectedNotes();
    }
    catch (e) {
        log.error(`Could not decrypt protected notes: ${e.message} ${e.stack}`);
    }
});

eventService.subscribe(eventService.LEAVE_PROTECTED_SESSION, () => {
    load();
});

module.exports = {
    load
};
