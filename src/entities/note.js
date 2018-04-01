"use strict";

const Entity = require('./entity');
const protected_session = require('../services/protected_session');
const repository = require('../services/repository');
const utils = require('../services/utils');

class Note extends Entity {
    static get tableName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }

    constructor(row) {
        super(row);

        if (this.isProtected) {
            protected_session.decryptNote(this);
        }

        if (this.isJson()) {
            this.jsonContent = JSON.parse(this.content);
        }
    }

    isJson() {
        return this.mime === "application/json";
    }

    isJavaScript() {
        return (this.type === "code" || this.type === "file")
            && (this.mime.startsWith("application/javascript") || this.mime === "application/x-javascript");
    }

    isHtml() {
        return (this.type === "code" || this.type === "file") && this.mime === "text/html";
    }

    getScriptEnv() {
        if (this.isHtml() || (this.isJavaScript() && this.mime.endsWith('env=frontend'))) {
            return "frontend";
        }

        if (this.type === 'render') {
            return "frontend";
        }

        if (this.isJavaScript() && this.mime.endsWith('env=backend')) {
            return "backend";
        }

        return null;
    }

    async getLabels() {
        return await repository.getEntities("SELECT * FROM labels WHERE noteId = ? AND isDeleted = 0", [this.noteId]);
    }

    // WARNING: this doesn't take into account the possibility to have multi-valued labels!
    async getLabelMap() {
        const map = {};

        for (const label of await this.getLabels()) {
            map[label.name] = label.value;
        }

        return map;
    }

    async hasLabel(name) {
        const map = await this.getLabelMap();

        return map.hasOwnProperty(name);
    }

    // WARNING: this doesn't take into account the possibility to have multi-valued labels!
    async getLabel(name) {
        return await repository.getEntity("SELECT * FROM labels WHERE noteId = ? AND name = ?", [this.noteId, name]);
    }

    async getRevisions() {
        return await repository.getEntities("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId]);
    }

    async getNoteImages() {
        return await repository.getEntities("SELECT * FROM note_images WHERE noteId = ? AND isDeleted = 0", [this.noteId]);
    }

    async getBranches() {
        return await repository.getEntities("SELECT * FROM branches WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    async getChildNote(name) {
        return await repository.getEntity(`
          SELECT notes.* 
          FROM branches 
            JOIN notes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND branches.isDeleted = 0
                AND branches.parentNoteId = ?
                AND notes.title = ?`, [this.noteId, name]);
    }

    async getChildNotes() {
        return await repository.getEntities(`
          SELECT notes.* 
          FROM branches 
            JOIN notes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND branches.isDeleted = 0
                AND branches.parentNoteId = ?
          ORDER BY branches.notePosition`, [this.noteId]);
    }

    async getChildBranches() {
        return await repository.getEntities(`
          SELECT branches.* 
          FROM branches 
          WHERE branches.isDeleted = 0
                AND branches.parentNoteId = ?
          ORDER BY branches.notePosition`, [this.noteId]);
    }

    async getParentNotes() {
        return await repository.getEntities(`
          SELECT parent_notes.* 
          FROM 
            branches AS child_tree 
            JOIN notes AS parent_notes ON parent_notes.noteId = child_tree.parentNoteId 
          WHERE child_tree.noteId = ?
                AND child_tree.isDeleted = 0
                AND parent_notes.isDeleted = 0`, [this.noteId]);
    }

    beforeSaving() {
        if (!this.noteId) {
            this.noteId = utils.newNoteId();
        }

        if (this.isJson()) {
            this.content = JSON.stringify(this.jsonContent, null, '\t');
        }

        if (this.isProtected) {
            protected_session.encryptNote(this);
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = utils.nowDate();
        }

        this.dateModified = utils.nowDate();
    }
}

module.exports = Note;