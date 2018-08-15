"use strict";

const Entity = require('./entity');
const Attribute = require('./attribute');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');

const LABEL = 'label';
const RELATION = 'relation';

class Note extends Entity {
    static get tableName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }
    static get hashedProperties() { return ["noteId", "title", "content", "type", "isProtected", "isDeleted"]; }

    constructor(row) {
        super(row);

        this.isProtected = !!this.isProtected;

        // check if there's noteId, otherwise this is a new entity which wasn't encrypted yet
        if (this.isProtected && this.noteId) {
            protectedSessionService.decryptNote(this);
        }

        this.setContent(this.content);
    }

    setContent(content) {
        this.content = content;

        try {
            this.jsonContent = JSON.parse(this.content);
        }
        catch(e) {}
    }

    isRoot() {
        return this.noteId === 'root';
    }

    isJson() {
        return this.mime === "application/json";
    }

    isJavaScript() {
        return (this.type === "code" || this.type === "file")
            && (this.mime.startsWith("application/javascript") || this.mime === "application/x-javascript");
    }

    isHtml() {
        return (this.type === "code" || this.type === "file" || this.type === "render") && this.mime === "text/html";
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

    async getOwnedAttributes() {
        return await repository.getEntities(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ?`, [this.noteId]);
    }

    async getAttributes() {
        if (!this.__attributeCache) {
            await this.loadAttributesToCache();
        }

        return this.__attributeCache;
    }

    async getLabels() {
        return (await this.getAttributes()).filter(attr => attr.type === LABEL);
    }

    async getRelations() {
        return (await this.getAttributes()).filter(attr => attr.type === RELATION);
    }

    invalidateAttributeCache() {
        this.__attributeCache = null;
    }

    async loadAttributesToCache() {
        const attributes = await repository.getEntities(`
            WITH RECURSIVE
            tree(noteId, level) AS (
                SELECT ?, 0
                UNION
                SELECT branches.parentNoteId, tree.level + 1 FROM branches
                    JOIN tree ON branches.noteId = tree.noteId
                    JOIN notes ON notes.noteId = branches.parentNoteId
                WHERE notes.isDeleted = 0
                  AND branches.isDeleted = 0
            ),
            treeWithAttrs(noteId, level) AS (
                SELECT * FROM tree
                UNION
                SELECT attributes.value, treeWithAttrs.level + 1 FROM attributes
                     JOIN treeWithAttrs ON treeWithAttrs.noteId = attributes.noteId
                WHERE attributes.isDeleted = 0
                  AND attributes.type = 'relation'
                  AND attributes.name = 'inheritAttributes'
                  AND (attributes.noteId = ? OR attributes.isInheritable = 1)
                )
            SELECT attributes.* FROM attributes JOIN treeWithAttrs ON attributes.noteId = treeWithAttrs.noteId
            WHERE attributes.isDeleted = 0 AND (attributes.isInheritable = 1 OR attributes.noteId = ?)
            ORDER BY level, noteId, position`, [this.noteId, this.noteId, this.noteId]);
        // attributes are ordered so that "closest" attributes are first
        // we order by noteId so that attributes from same note stay together. Actual noteId ordering doesn't matter.

        const filteredAttributes = attributes.filter((attr, index) => {
            if (attr.isDefinition()) {
                const firstDefinitionIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

                // keep only if this element is the first definition for this type & name
                return firstDefinitionIndex === index;
            }
            else {
                const definitionAttr = attributes.find(el => el.type === attr.type + '-definition' && el.name === attr.name);

                if (!definitionAttr) {
                    return true;
                }

                const definition = definitionAttr.value;

                if (definition.multiplicityType === 'multivalue') {
                    return true;
                }
                else {
                    const firstAttrIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

                    // in case of single-valued attribute we'll keep it only if it's first (closest)
                    return firstAttrIndex === index;
                }
            }
        });

        for (const attr of filteredAttributes) {
            attr.isOwned = attr.noteId === this.noteId;
        }

        this.__attributeCache = filteredAttributes;
    }

    async hasAttribute(type, name) {
        return !!await this.getAttribute(type, name);
    }

    // WARNING: this doesn't take into account the possibility to have multi-valued labels!
    async getAttribute(type, name) {
        const attributes = await this.getAttributes();

        return attributes.find(attr => attr.type === type && attr.name === name);
    }

    async getAttributeValue(type, name) {
        const attr = await this.getAttribute(type, name);

        return attr ? attr.value : null;
    }

    async toggleAttribute(type, enabled, name, value = "") {
        if (enabled) {
            await this.setAttribute(type, name, value);
        }
        else {
            await this.removeAttribute(type, name, value);
        }
    }

    async setAttribute(type, name, value = "") {
        const attributes = await this.getOwnedAttributes();
        let attr = attributes.find(attr => attr.type === type && attr.value === value);

        if (!attr) {
            attr = new Attribute({
                noteId: this.noteId,
                type: type,
                name: name,
                value: value
            });

            await attr.save();

            this.invalidateAttributeCache();
        }
    }

    async removeAttribute(type, name, value = "") {
        const attributes = await this.getOwnedAttributes();

        for (const attribute of attributes) {
            if (attribute.type === type && (!value || value === attribute.value)) {
                attribute.isDeleted = true;
                await attribute.save();

                this.invalidateAttributeCache();
            }
        }
    }

    async hasLabel(name) { return await this.hasAttribute(LABEL, name); }
    async hasRelation(name) { return await this.hasAttribute(RELATION, name); }

    async getLabel(name) { return await this.getAttribute(LABEL, name); }
    async getRelation(name) { return await this.getAttribute(RELATION, name); }

    async getLabelValue(name) { return await this.getAttributeValue(LABEL, name); }
    async getRelationValue(name) { return await this.getAttributeValue(RELATION, name); }

    async toggleLabel(enabled, name, value = "") { return await this.toggleAttribute(LABEL, enabled, name, value); }
    async toggleRelation(enabled, name, value = "") { return await this.toggleAttribute(RELATION, enabled, name, value); }

    async setLabel(name, value = "") { return await this.setAttribute(LABEL, name, value); }
    async setRelation(name, value = "") { return await this.setAttribute(RELATION, name, value); }

    async removeLabel(name, value = "") { return await this.removeAttribute(LABEL, name, value); }
    async removeRelation(name, value = "") { return await this.removeAttribute(RELATION, name, value); }

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
        if (this.isJson() && this.jsonContent) {
            this.content = JSON.stringify(this.jsonContent, null, '\t');
        }

        if (this.isProtected) {
            protectedSessionService.encryptNote(this);
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.dateModified = dateUtils.nowDate();
        }
    }
}

module.exports = Note;