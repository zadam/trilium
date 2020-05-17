"use strict";

const Note = require('./entities/note');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');
const sql = require('../sql.js');
const sqlInit = require('../sql_init.js');
const eventService = require('../events.js');

class NoteCache {
    constructor() {
        /** @type {Object.<String, Note>} */
        this.notes = null;
        /** @type {Object.<String, Branch>} */
        this.branches = null;
        /** @type {Object.<String, Branch>} */
        this.childParentToBranch = {};
        /** @type {Object.<String, Attribute>} */
        this.attributes = null;
        /** @type {Object.<String, Attribute[]>} Points from attribute type-name to list of attributes them */
        this.attributeIndex = null;

        this.loaded = false;
        this.loadedPromise = this.load();
    }

    /** @return {Attribute[]} */
    findAttributes(type, name) {
        return this.attributeIndex[`${type}-${name}`] || [];
    }

    async load() {
        await sqlInit.dbReady;

        this.notes = await this.getMappedRows(`SELECT noteId, title, isProtected FROM notes WHERE isDeleted = 0`,
            row => new Note(this, row));

        this.branches = await this.getMappedRows(`SELECT branchId, noteId, parentNoteId, prefix FROM branches WHERE isDeleted = 0`,
            row => new Branch(this, row));

        this.attributeIndex = [];

        this.attributes = await this.getMappedRows(`SELECT attributeId, noteId, type, name, value, isInheritable FROM attributes WHERE isDeleted = 0`,
            row => new Attribute(this, row));

        this.loaded = true;
    }

    async getMappedRows(query, cb) {
        const map = {};
        const results = await sql.getRows(query, []);

        for (const row of results) {
            const keys = Object.keys(row);

            map[row[keys[0]]] = cb(row);
        }

        return map;
    }

    decryptProtectedNotes() {
        for (const note of Object.values(this.notes)) {
            note.decrypt();
        }
    }

    getBranch(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
    }
}

const noteCache = new NoteCache();

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
            const note = new Note(entity);
            noteCache.notes[noteId] = note;

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
            noteCache.branches[branchId] = new Branch(entity);

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
            const attr = new Attribute(entity);
            noteCache.attributes[attributeId] = attr;

            if (note) {
                if (attr.isAffectingSubtree || note.isTemplate) {
                    note.invalidateSubtreeCaches();
                }
                else {
                    this.invalidateThisCache();
                }
            }
        }
    }
});

eventService.subscribe(eventService.ENTER_PROTECTED_SESSION, () => {
    noteCache.loadedPromise.then(() => noteCache.decryptProtectedNotes());
});

module.exports = noteCache;
