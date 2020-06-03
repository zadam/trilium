"use strict";

const sql = require('../sql.js');
const sqlInit = require('../sql_init.js');
const eventService = require('../events.js');
const noteCache = require('./note_cache');
const Note = require('./entities/note');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');

async function load() {
    await sqlInit.dbReady;

    noteCache.reset();

    (await sql.getRows(`SELECT noteId, title, type, mime, isProtected, dateCreated, dateModified, utcDateCreated, utcDateModified, contentLength FROM notes WHERE isDeleted = 0`, []))
        .map(row => new Note(noteCache, row));

    (await sql.getRows(`SELECT branchId, noteId, parentNoteId, prefix FROM branches WHERE isDeleted = 0`, []))
        .map(row => new Branch(noteCache, row));

    (await sql.getRows(`SELECT attributeId, noteId, type, name, value, isInheritable FROM attributes WHERE isDeleted = 0`, [])).map(row => new Attribute(noteCache, row));

    noteCache.loaded = true;
    noteCache.loadedResolve();
}

eventService.subscribe([eventService.ENTITY_CHANGED, eventService.ENTITY_DELETED, eventService.ENTITY_SYNCED],  async ({entityName, entity}) => {
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
            const note = noteCache.notes[noteId];

            // we can assume we have protected session since we managed to update
            note.title = entity.title;
            note.isProtected = entity.isProtected;
            note.isDecrypted = !entity.isProtected || !!entity.isContentAvailable;
            note.flatTextCache = null;

            note.decrypt();
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
            delete noteCache.attributeIndex[`${attr.type}-${attr.name}`];
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
    noteCache.loadedPromise.then(() => noteCache.decryptProtectedNotes());
});

load();
