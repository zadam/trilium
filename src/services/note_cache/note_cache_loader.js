"use strict";

const sql = require('../sql.js');
const eventService = require('../events.js');
const noteCache = require('./note_cache');
const sqlInit = require('../sql_init');
const log = require('../log');
const Note = require('./entities/note');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');

sqlInit.dbReady.then(() => {
    load();
});

function load() {
    noteCache.reset();

    for (const row of sql.iterateRows(`SELECT noteId, title, type, mime, isProtected, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes WHERE isDeleted = 0`, [])) {
        new Note(noteCache, row);
    }

    for (const row of sql.iterateRows(`SELECT branchId, noteId, parentNoteId, prefix FROM branches WHERE isDeleted = 0`, [])) {
        new Branch(noteCache, row);
    }

    for (const row of sql.iterateRows(`SELECT attributeId, noteId, type, name, value, isInheritable FROM attributes WHERE isDeleted = 0`, [])) {
        new Attribute(noteCache, row);
    }

    noteCache.loaded = true;
}

eventService.subscribe([eventService.ENTITY_CHANGED, eventService.ENTITY_DELETED, eventService.ENTITY_SYNCED],  ({entityName, entity}) => {
    // note that entity can also be just POJO without methods if coming from sync

    if (!noteCache.loaded) {
        return;
    }

    if (entityName === 'notes') {
        const {noteId} = entity;

        if (entity.isDeleted) {
            delete noteCache.notes[noteId];
        }
        else if (noteId in noteCache.notes) {
            noteCache.notes[noteId].update(entity);
        }
        else {
            const note = new Note(noteCache, entity);

            note.decrypt();
        }
    }
    else if (entityName === 'branches') {
        const {branchId, noteId, parentNoteId} = entity;
        const childNote = noteCache.notes[noteId];

        if (entity.isDeleted) {
            if (childNote) {
                childNote.parents = childNote.parents.filter(parent => parent.noteId !== parentNoteId);
                childNote.parentBranches = childNote.parentBranches.filter(branch => branch.branchId !== branchId);

                if (childNote.parents.length > 0) {
                    childNote.invalidateSubtreeCaches();
                }
            }

            const parentNote = noteCache.notes[parentNoteId];

            if (parentNote) {
                parentNote.children = parentNote.children.filter(child => child.noteId !== noteId);
            }

            delete noteCache.childParentToBranch[`${noteId}-${parentNoteId}`];
            delete noteCache.branches[branchId];
        }
        else if (branchId in noteCache.branches) {
            // only relevant thing which can change in a branch is prefix
            noteCache.branches[branchId].prefix = entity.prefix;

            if (childNote) {
                childNote.flatTextCache = null;
            }
        }
        else {
            noteCache.branches[branchId] = new Branch(noteCache, entity);

            if (childNote) {
                childNote.resortParents();
            }
        }
    }
    else if (entityName === 'attributes') {
        const {attributeId, noteId} = entity;
        const note = noteCache.notes[noteId];
        const attr = noteCache.attributes[attributeId];

        if (entity.isDeleted) {
            if (note && attr) {
                // first invalidate and only then remove the attribute (otherwise invalidation wouldn't be complete)
                if (attr.isAffectingSubtree || note.isTemplate) {
                    note.invalidateSubtreeCaches();
                }

                note.ownedAttributes = note.ownedAttributes.filter(attr => attr.attributeId !== attributeId);

                const targetNote = attr.targetNote;

                if (targetNote) {
                    targetNote.targetRelations = targetNote.targetRelations.filter(rel => rel.attributeId !== attributeId);
                }
            }

            delete noteCache.attributes[attributeId];

            if (attr) {
                delete noteCache.attributeIndex[`${attr.type}-${attr.name}`];
            }
        }
        else if (attributeId in noteCache.attributes) {
            const attr = noteCache.attributes[attributeId];

            // attr name and isInheritable are immutable
            attr.value = entity.value;

            if (attr.isAffectingSubtree || note.isTemplate) {
                note.invalidateSubtreeFlatText();
            }
            else {
                note.flatTextCache = null;
            }
        }
        else {
            const attr = new Attribute(noteCache, entity);

            if (note) {
                if (attr.isAffectingSubtree || note.isTemplate) {
                    note.invalidateSubtreeCaches();
                }
                else {
                    note.invalidateThisCache();
                }
            }
        }
    }
});

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    try {
        noteCache.decryptProtectedNotes();
    }
    catch (e) {
        log.error(`Could not decrypt protected notes: ${e.message} ${e.stack}`);
    }
});

module.exports = {
    load
};
