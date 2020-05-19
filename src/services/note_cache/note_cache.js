"use strict";

const Note = require('./entities/note');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');

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
        this.loadedResolve = null;
        this.loadedPromise = new Promise(res => {this.loadedResolve = res;});
    }

    /** @return {Attribute[]} */
    findAttributes(type, name) {
        return this.attributeIndex[`${type}-${name}`] || [];
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

module.exports = noteCache;
