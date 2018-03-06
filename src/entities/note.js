"use strict";

const Entity = require('./entity');
const protected_session = require('../services/protected_session');

class Note extends Entity {
    static get tableName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }

    constructor(repository, row) {
        super(repository, row);

        if (this.isProtected) {
            protected_session.decryptNote(this.dataKey, this);
        }

        if (this.isJson()) {
            this.jsonContent = JSON.parse(this.content);
        }
    }

    isJson() {
        return this.type === "code" && this.mime === "application/json";
    }

    isJavaScript() {
        return (this.type === "code" || this.type === "file")
            && (this.mime.startsWith("application/javascript") || this.mime === "application/x-javascript");
    }

    isHtml() {
        return (this.type === "code" || this.type === "file") && this.mime === "text/html";
    }

    async getAttributes() {
        return this.repository.getEntities("SELECT * FROM attributes WHERE noteId = ? AND isDeleted = 0", [this.noteId]);
    }

    // WARNING: this doesn't take into account the possibility to have multi-valued attributes!
    async getAttributeMap() {
        const map = {};

        for (const attr of await this.getAttributes()) {
            map[attr.name] = attr.value;
        }

        return map;
    }

    async hasAttribute(name) {
        const map = await this.getAttributeMap();

        return map.hasOwnProperty(name);
    }

    // WARNING: this doesn't take into account the possibility to have multi-valued attributes!
    async getAttribute(name) {
        return this.repository.getEntity("SELECT * FROM attributes WHERE noteId = ? AND name = ?", [this.noteId, name]);
    }

    async getRevisions() {
        return this.repository.getEntities("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId]);
    }

    async getTrees() {
        return this.repository.getEntities("SELECT * FROM note_tree WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    async getChild(name) {
        return this.repository.getEntity(`
          SELECT notes.* 
          FROM note_tree 
            JOIN notes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND note_tree.isDeleted = 0
                AND note_tree.parentNoteId = ?
                AND notes.title = ?`, [this.noteId, name]);
    }

    async getChildren() {
        return this.repository.getEntities(`
          SELECT notes.* 
          FROM note_tree 
            JOIN notes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND note_tree.isDeleted = 0
                AND note_tree.parentNoteId = ?
          ORDER BY note_tree.notePosition`, [this.noteId]);
    }

    async getParents() {
        return this.repository.getEntities(`
          SELECT parent_notes.* 
          FROM 
            note_tree AS child_tree 
            JOIN notes AS parent_notes ON parent_notes.noteId = child_tree.parentNoteId 
          WHERE child_tree.noteId = ?
                AND child_tree.isDeleted = 0
                AND parent_notes.isDeleted = 0`, [this.noteId]);
    }

    async getNoteTree() {
        return this.repository.getEntities(`
          SELECT note_tree.* 
          FROM note_tree 
            JOIN notes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND note_tree.isDeleted = 0
                AND note_tree.noteId = ?`, [this.noteId]);
    }

    beforeSaving() {
        this.content = JSON.stringify(this.jsonContent, null, '\t');

        if (this.isProtected) {
            protected_session.encryptNote(this.dataKey, this);
        }
    }
}

module.exports = Note;