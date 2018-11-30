"use strict";

const Entity = require('./entity');
const Attribute = require('./attribute');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');
const sql = require('../services/sql');
const dateUtils = require('../services/date_utils');

const LABEL = 'label';
const LABEL_DEFINITION = 'label-definition';
const RELATION = 'relation';
const RELATION_DEFINITION = 'relation-definition';

/**
 * This represents a Note which is a central object in the Trilium Notes project.
 *
 * @property {string} noteId - primary key
 * @property {string} type - one of "text", "code", "file" or "render"
 * @property {string} mime - MIME type, e.g. "text/html"
 * @property {string} title - note title
 * @property {string} content - note content - e.g. HTML text for text notes, file payload for files
 * @property {boolean} isProtected - true if note is protected
 * @property {boolean} isDeleted - true if note is deleted
 * @property {string} dateCreated
 * @property {string} dateModified
 *
 * @extends Entity
 */
class Note extends Entity {
    static get entityName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }
    static get hashedProperties() { return ["noteId", "title", "content", "type", "isProtected", "isDeleted"]; }

    /**
     * @param row - object containing database row from "notes" table
     */
    constructor(row) {
        super(row);

        this.isProtected = !!this.isProtected;
        /* true if content (meaning any kind of potentially encrypted content) is either not encrypted
         * or encrypted, but with available protected session (so effectively decrypted) */
        this.isContentAvailable = true;

        // check if there's noteId, otherwise this is a new entity which wasn't encrypted yet
        if (this.isProtected && this.noteId) {
            this.isContentAvailable = protectedSessionService.isProtectedSessionAvailable();

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

    /** @returns {boolean} true if this note is the root of the note tree. Root note has "root" noteId */
    isRoot() {
        return this.noteId === 'root';
    }

    /** @returns {boolean} true if this note is of application/json content type */
    isJson() {
        return this.mime === "application/json";
    }

    /** @returns {boolean} true if this note is JavaScript (code or attachment) */
    isJavaScript() {
        return (this.type === "code" || this.type === "file")
            && (this.mime.startsWith("application/javascript")
                || this.mime === "application/x-javascript"
                || this.mime === "text/javascript");
    }

    /** @returns {boolean} true if this note is HTML */
    isHtml() {
        return (this.type === "code" || this.type === "file" || this.type === "render") && this.mime === "text/html";
    }

    /** @returns {string} JS script environment - either "frontend" or "backend" */
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

    /**
     * @returns {Promise<Attribute[]>} attributes belonging to this specific note (excludes inherited attributes)
     */
    async getOwnedAttributes() {
        return await repository.getEntities(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ?`, [this.noteId]);
    }

    /**
     * @returns {Promise<Attribute[]>} relations targetting this specific note
     */
    async getTargetRelations() {
        return await repository.getEntities("SELECT * FROM attributes WHERE type = 'relation' AND isDeleted = 0 AND value = ?", [this.noteId]);
    }

    /**
     * @param {string} [name] - attribute name to filter
     * @returns {Promise<Attribute[]>} all note's attributes, including inherited ones
     */
    async getAttributes(name) {
        if (!this.__attributeCache) {
            await this.loadAttributesToCache();
        }

        if (name) {
            return this.__attributeCache.filter(attr => attr.name === name);
        }
        else {
            return this.__attributeCache;
        }
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Promise<Attribute[]>} all note's labels (attributes with type label), including inherited ones
     */
    async getLabels(name) {
        return (await this.getAttributes(name)).filter(attr => attr.type === LABEL);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Promise<Attribute[]>} all note's label definitions, including inherited ones
     */
    async getLabelDefinitions(name) {
        return (await this.getAttributes(name)).filter(attr => attr.type === LABEL_DEFINITION);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<Attribute[]>} all note's relations (attributes with type relation), including inherited ones
     */
    async getRelations(name) {
        return (await this.getAttributes(name)).filter(attr => attr.type === RELATION);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<Attribute[]>} all note's relation definitions including inherited ones
     */
    async getRelationDefinitions(name) {
        return (await this.getAttributes(name)).filter(attr => attr.type === RELATION_DEFINITION);
    }

    /**
     * Clear note's attributes cache to force fresh reload for next attribute request.
     * Cache is note instance scoped.
     */
    invalidateAttributeCache() {
        this.__attributeCache = null;
    }

    /** @returns {Promise<void>} */
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
                  AND attributes.name = 'template'
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

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<boolean>} true if note has an attribute with given type and name (including inherited)
     */
    async hasAttribute(type, name) {
        return !!await this.getAttribute(type, name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<Attribute>} attribute of given type and name. If there's more such attributes, first is  returned. Returns null if there's no such attribute belonging to this note.
     */
    async getAttribute(type, name) {
        const attributes = await this.getAttributes();

        return attributes.find(attr => attr.type === type && attr.name === name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<string>} attribute value of given type and name or null if no such attribute exists.
     */
    async getAttributeValue(type, name) {
        const attr = await this.getAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * Based on enabled, attribute is either set or removed.
     *
     * @param {string} type - attribute type ('relation', 'label' etc.)
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     * @returns {Promise<void>}
     */
    async toggleAttribute(type, enabled, name, value) {
        if (enabled) {
            await this.setAttribute(type, name, value);
        }
        else {
            await this.removeAttribute(type, name, value);
        }
    }

    /**
     * Creates given attribute name-value pair if it doesn't exist.
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     * @returns {Promise<void>}
     */
    async setAttribute(type, name, value) {
        const attributes = await this.getOwnedAttributes();
        let attr = attributes.find(attr => attr.type === type && (value === undefined || attr.value === value));

        if (!attr) {
            attr = new Attribute({
                noteId: this.noteId,
                type: type,
                name: name,
                value: value !== undefined ? value : ""
            });

            await attr.save();

            this.invalidateAttributeCache();
        }
    }

    /**
     * Removes given attribute name-value pair if it exists.
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     * @returns {Promise<void>}
     */
    async removeAttribute(type, name, value) {
        const attributes = await this.getOwnedAttributes();

        for (const attribute of attributes) {
            if (attribute.type === type && (value === undefined || value === attribute.value)) {
                attribute.isDeleted = true;
                await attribute.save();

                this.invalidateAttributeCache();
            }
        }
    }

    /**
     * @param {string} name - label name
     * @returns {Promise<boolean>} true if label exists (including inherited)
     */
    async hasLabel(name) { return await this.hasAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<boolean>} true if relation exists (including inherited)
     */
    async hasRelation(name) { return await this.hasAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<Attribute>} label if it exists, null otherwise
     */
    async getLabel(name) { return await this.getAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<Attribute>} relation if it exists, null otherwise
     */
    async getRelation(name) { return await this.getAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<string>} label value if label exists, null otherwise
     */
    async getLabelValue(name) { return await this.getAttributeValue(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<string>} relation value if relation exists, null otherwise
     */
    async getRelationValue(name) { return await this.getAttributeValue(RELATION, name); }

    /**
     * Based on enabled, label is either set or removed.
     *
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - label name
     * @param {string} [value] - label value (optional)
     * @returns {Promise<void>}
     */
    async toggleLabel(enabled, name, value) { return await this.toggleAttribute(LABEL, enabled, name, value); }

    /**
     * Based on enabled, relation is either set or removed.
     *
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     * @returns {Promise<void>}
     */
    async toggleRelation(enabled, name, value) { return await this.toggleAttribute(RELATION, enabled, name, value); }

    /**
     * Create label name-value pair if it doesn't exist yet.
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {Promise<void>}
     */
    async setLabel(name, value) { return await this.setAttribute(LABEL, name, value); }

    /**
     * Create relation name-value pair if it doesn't exist yet.
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     * @returns {Promise<void>}
     */
    async setRelation(name, value) { return await this.setAttribute(RELATION, name, value); }

    /**
     * Remove label name-value pair, if it exists.
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {Promise<void>}
     */
    async removeLabel(name, value) { return await this.removeAttribute(LABEL, name, value); }

    /**
     * Remove relation name-value pair, if it exists.
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     * @returns {Promise<void>}
     */
    async removeRelation(name, value) { return await this.removeAttribute(RELATION, name, value); }

    /**
     * @param {string} name
     * @returns {Promise<Note>|null} target note of the relation or null (if target is empty or note was not found)
     */
    async getRelationTarget(name) {
        const relation = await this.getRelation(name);

        return relation ? await repository.getNote(relation.value) : null;
    }

    /**
     * @return {Promise<string[]>} return list of all descendant noteIds of this note. Returning just noteIds because number of notes can be huge. Includes also this note's noteId
     */
    async getDescendantNoteIds() {
        return await sql.getColumn(`
            WITH RECURSIVE
            tree(noteId) AS (
                SELECT ?
                UNION
                SELECT branches.noteId FROM branches
                    JOIN tree ON branches.parentNoteId = tree.noteId
                    JOIN notes ON notes.noteId = branches.noteId
                WHERE notes.isDeleted = 0
                  AND branches.isDeleted = 0
            )
            SELECT noteId FROM tree`, [this.noteId]);
    }

    /**
     * Finds descendant notes with given attribute name and value. Only own attributes are considered, not inherited ones
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value
     * @returns {Promise<Note[]>}
     */
    async getDescendantNotesWithAttribute(type, name, value) {
        const params = [this.noteId, name];
        let valueCondition = "";

        if (value !== undefined) {
            params.push(value);
            valueCondition = " AND attributes.value = ?";
        }

        const notes = await repository.getEntities(`
            WITH RECURSIVE
            tree(noteId) AS (
                SELECT ?
                UNION
                SELECT branches.noteId FROM branches
                    JOIN tree ON branches.parentNoteId = tree.noteId
                    JOIN notes ON notes.noteId = branches.noteId
                WHERE notes.isDeleted = 0
                  AND branches.isDeleted = 0
            )
            SELECT notes.* FROM notes 
            JOIN tree ON tree.noteId = notes.noteId
            JOIN attributes ON attributes.noteId = notes.noteId
            WHERE attributes.isDeleted = 0 
              AND attributes.name = ?
              ${valueCondition} 
            ORDER BY noteId, position`, params);

        return notes;
    }

    /**
     * Finds descendant notes with given label name and value. Only own labels are considered, not inherited ones
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {Promise<Note[]>}
     */
    async getDescendantNotesWithLabel(name, value) { return await this.getDescendantNotesWithAttribute(LABEL, name, value); }

    /**
     * Finds descendant notes with given relation name and value. Only own relations are considered, not inherited ones
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value
     * @returns {Promise<Note[]>}
     */
    async getDescendantNotesWithRelation(name, value) { return await this.getDescendantNotesWithAttribute(RELATION, name, value); }

    /**
     * Returns note revisions of this note.
     *
     * @returns {Promise<NoteRevision[]>}
     */
    async getRevisions() {
        return await repository.getEntities("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId]);
    }

    /**
     * Get list of links coming out of this note.
     *
     * @returns {Promise<Link[]>}
     */
    async getLinks() {
        return await repository.getEntities("SELECT * FROM links WHERE noteId = ? AND isDeleted = 0", [this.noteId]);
    }

    /**
     * Get list of links targetting this note.
     *
     * @returns {Promise<Link[]>}
     */
    async getTargetLinks() {
        return await repository.getEntities("SELECT * FROM links WHERE targetNoteId = ? AND isDeleted = 0", [this.noteId]);
    }

    /**
     * Return all links from this note, including deleted ones.
     *
     * @returns {Promise<Link[]>}
     */
    async getLinksWithDeleted() {
        return await repository.getEntities("SELECT * FROM links WHERE noteId = ?", [this.noteId]);
    }

    /**
     * @returns {Promise<Branch[]>}
     */
    async getBranches() {
        return await repository.getEntities("SELECT * FROM branches WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    /**
     * @returns {boolean} - true if note has children
     */
    async hasChildren() {
        return (await this.getChildNotes()).length > 0;
    }

    /**
     * @returns {Promise<Note[]>} child notes of this note
     */
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

    /**
     * @returns {Promise<Branch[]>} child branches of this note
     */
    async getChildBranches() {
        return await repository.getEntities(`
          SELECT branches.* 
          FROM branches 
          WHERE branches.isDeleted = 0
                AND branches.parentNoteId = ?
          ORDER BY branches.notePosition`, [this.noteId]);
    }

    /**
     * @returns {Promise<Note[]>} parent notes of this note (note can have multiple parents because of cloning)
     */
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

        // we do this here because encryption needs the note ID for the IV
        this.generateIdIfNecessary();

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

    // cannot be static!
    updatePojo(pojo) {
        if (pojo.isProtected) {
            protectedSessionService.encryptNote(pojo);
        }

        delete pojo.jsonContent;
        delete pojo.isContentAvailable;
        delete pojo.__attributeCache;
    }
}

module.exports = Note;