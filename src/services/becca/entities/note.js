"use strict";

const protectedSessionService = require('../../protected_session');
const log = require('../../log');
const sql = require('../../sql');
const utils = require('../../utils');
const dateUtils = require('../../date_utils');
const entityChangesService = require('../../entity_changes.js');
const AbstractEntity = require("./abstract_entity.js");
const NoteRevision = require("./note_revision.js");

const LABEL = 'label';
const RELATION = 'relation';

class Note extends AbstractEntity {
    static get entityName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }
    static get hashedProperties() { return ["noteId", "title", "isProtected", "type", "mime"]; }

    constructor(row) {
        super();

        this.update(row);

        /** @param {Branch[]} */
        this.parentBranches = [];
        /** @param {Note[]} */
        this.parents = [];
        /** @param {Note[]} */
        this.children = [];
        /** @param {Attribute[]} */
        this.ownedAttributes = [];

        /** @param {Attribute[]|null} */
        this.__attributeCache = null;
        /** @param {Attribute[]|null} */
        this.inheritableAttributeCache = null;

        /** @param {Attribute[]} */
        this.targetRelations = [];

        this.becca.notes[this.noteId] = this;

        /** @param {Note[]|null} */
        this.ancestorCache = null;

        // following attributes are filled during searching from database

        /** @param {int} size of the content in bytes */
        this.contentSize = null;
        /** @param {int} size of the content and note revision contents in bytes */
        this.noteSize = null;
        /** @param {int} number of note revisions for this note */
        this.revisionCount = null;
    }

    update(row) {
        // ------ Database persisted attributes ------

        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.title = row.title;
        /** @param {boolean} */
        this.isProtected = !!row.isProtected;
        /** @param {string} */
        this.type = row.type;
        /** @param {string} */
        this.mime = row.mime;
        /** @param {string} */
        this.dateCreated = row.dateCreated || dateUtils.localNowDateTime();
        /** @param {string} */
        this.dateModified = row.dateModified;
        /** @param {string} */
        this.utcDateCreated = row.utcDateCreated || dateUtils.utcNowDateTime();
        /** @param {string} */
        this.utcDateModified = row.utcDateModified;

        // ------ Derived attributes ------

        /** @param {boolean} */
        this.isDecrypted = !row.isProtected || !!row.isContentAvailable;

        this.decrypt();

        /** @param {string|null} */
        this.flatTextCache = null;
    }

    getParentBranches() {
        return this.parentBranches;
    }

    getBranches() {
        return this.parentBranches;
    }

    getParentNotes() {
        return this.parents;
    }

    getChildNotes() {
        return this.children;
    }

    getChildBranches() {
        return this.children.map(childNote => this.becca.getBranchFromChildAndParent(childNote.noteId, this.noteId));
    }

    /*
     * Note content has quite special handling - it's not a separate entity, but a lazily loaded
     * part of Note entity with it's own sync. Reasons behind this hybrid design has been:
     *
     * - content can be quite large and it's not necessary to load it / fill memory for any note access even if we don't need a content, especially for bulk operations like search
     * - changes in the note metadata or title should not trigger note content sync (so we keep separate utcDateModified and entity changes records)
     * - but to the user note content and title changes are one and the same - single dateModified (so all changes must go through Note and content is not a separate entity)
     */

    /** @returns {*} */
    getContent(silentNotFoundError = false) {
        const row = sql.getRow(`SELECT content FROM note_contents WHERE noteId = ?`, [this.noteId]);

        if (!row) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error("Cannot find note content for noteId=" + this.noteId);
            }
        }

        let content = row.content;

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                content = content === null ? null : protectedSessionService.decrypt(content);
            }
            else {
                content = "";
            }
        }

        if (this.isStringNote()) {
            return content === null
                ? ""
                : content.toString("UTF-8");
        }
        else {
            return content;
        }
    }

    /** @returns {{contentLength, dateModified, utcDateModified}} */
    getContentMetadata() {
        return sql.getRow(`
            SELECT 
                LENGTH(content) AS contentLength, 
                dateModified,
                utcDateModified 
            FROM note_contents 
            WHERE noteId = ?`, [this.noteId]);
    }

    /** @returns {*} */
    getJsonContent() {
        const content = this.getContent();

        if (!content || !content.trim()) {
            return null;
        }

        return JSON.parse(content);
    }

    setContent(content) {
        if (content === null || content === undefined) {
            throw new Error(`Cannot set null content to note ${this.noteId}`);
        }

        if (this.isStringNote()) {
            content = content.toString();
        }
        else {
            content = Buffer.isBuffer(content) ? content : Buffer.from(content);
        }

        const pojo = {
            noteId: this.noteId,
            content: content,
            dateModified: dateUtils.localNowDateTime(),
            utcDateModified: dateUtils.utcNowDateTime()
        };

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                pojo.content = protectedSessionService.encrypt(pojo.content);
            }
            else {
                throw new Error(`Cannot update content of noteId=${this.noteId} since we're out of protected session.`);
            }
        }

        sql.upsert("note_contents", "noteId", pojo);

        const hash = utils.hash(this.noteId + "|" + pojo.content.toString());

        entityChangesService.addEntityChange({
            entityName: 'note_contents',
            entityId: this.noteId,
            hash: hash,
            isErased: false,
            utcDateChanged: pojo.utcDateModified
        }, null);
    }

    setJsonContent(content) {
        this.setContent(JSON.stringify(content, null, '\t'));
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
        return ["code", "file", "render"].includes(this.type)
            && this.mime === "text/html";
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    /** @returns {string|null} JS script environment - either "frontend" or "backend" */
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
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {Attribute[]} all note's attributes, including inherited ones
     */
    getAttributes(type, name) {
        this.__getAttributes([]);

        if (type && name) {
            return this.__attributeCache.filter(attr => attr.type === type && attr.name === name);
        }
        else if (type) {
            return this.__attributeCache.filter(attr => attr.type === type);
        }
        else if (name) {
            return this.__attributeCache.filter(attr => attr.name === name);
        }
        else {
            return this.__attributeCache.slice();
        }
    }

    __getAttributes(path) {
        if (path.includes(this.noteId)) {
            return [];
        }

        if (!this.__attributeCache) {
            const parentAttributes = this.ownedAttributes.slice();
            const newPath = [...path, this.noteId];

            if (this.noteId !== 'root') {
                for (const parentNote of this.parents) {
                    parentAttributes.push(...parentNote.__getInheritableAttributes(newPath));
                }
            }

            const templateAttributes = [];

            for (const ownedAttr of parentAttributes) { // parentAttributes so we process also inherited templates
                if (ownedAttr.type === 'relation' && ownedAttr.name === 'template') {
                    const templateNote = this.becca.notes[ownedAttr.value];

                    if (templateNote) {
                        templateAttributes.push(...templateNote.__getAttributes(newPath));
                    }
                }
            }

            this.__attributeCache = [];

            const addedAttributeIds = new Set();

            for (const attr of parentAttributes.concat(templateAttributes)) {
                if (!addedAttributeIds.has(attr.attributeId)) {
                    addedAttributeIds.add(attr.attributeId);

                    this.__attributeCache.push(attr);
                }
            }

            this.inheritableAttributeCache = [];

            for (const attr of this.__attributeCache) {
                if (attr.isInheritable) {
                    this.inheritableAttributeCache.push(attr);
                }
            }
        }

        return this.__attributeCache;
    }

    /** @return {Attribute[]} */
    __getInheritableAttributes(path) {
        if (path.includes(this.noteId)) {
            return [];
        }

        if (!this.inheritableAttributeCache) {
            this.__getAttributes(path); // will refresh also this.inheritableAttributeCache
        }

        return this.inheritableAttributeCache;
    }

    hasAttribute(type, name) {
        return !!this.getAttributes().find(attr => attr.type === type && attr.name === name);
    }

    getAttributeCaseInsensitive(type, name, value) {
        name = name.toLowerCase();
        value = value ? value.toLowerCase() : null;

        return this.getAttributes().find(
            attr => attr.type === type
            && attr.name.toLowerCase() === name
            && (!value || attr.value.toLowerCase() === value));
    }

    getRelationTarget(name) {
        const relation = this.getAttributes().find(attr => attr.type === 'relation' && attr.name === name);

        return relation ? relation.targetNote : null;
    }

    /**
     * @param {string} name - label name
     * @returns {boolean} true if label exists (including inherited)
     */
    hasLabel(name) { return this.hasAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {boolean} true if label exists (excluding inherited)
     */
    hasOwnedLabel(name) { return this.hasOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {boolean} true if relation exists (including inherited)
     */
    hasRelation(name) { return this.hasAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {boolean} true if relation exists (excluding inherited)
     */
    hasOwnedRelation(name) { return this.hasOwnedAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {Attribute|null} label if it exists, null otherwise
     */
    getLabel(name) { return this.getAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {Attribute|null} label if it exists, null otherwise
     */
    getOwnedLabel(name) { return this.getOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Attribute|null} relation if it exists, null otherwise
     */
    getRelation(name) { return this.getAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {Attribute|null} relation if it exists, null otherwise
     */
    getOwnedRelation(name) { return this.getOwnedAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {string|null} label value if label exists, null otherwise
     */
    getLabelValue(name) { return this.getAttributeValue(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {string|null} label value if label exists, null otherwise
     */
    getOwnedLabelValue(name) { return this.getOwnedAttributeValue(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {string|null} relation value if relation exists, null otherwise
     */
    getRelationValue(name) { return this.getAttributeValue(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {string|null} relation value if relation exists, null otherwise
     */
    getOwnedRelationValue(name) { return this.getOwnedAttributeValue(RELATION, name); }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {boolean} true if note has an attribute with given type and name (excluding inherited)
     */
    hasOwnedAttribute(type, name) {
        return !!this.getOwnedAttribute(type, name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Attribute} attribute of given type and name. If there's more such attributes, first is  returned. Returns null if there's no such attribute belonging to this note.
     */
    getAttribute(type, name) {
        const attributes = this.getAttributes();

        return attributes.find(attr => attr.type === type && attr.name === name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {string|null} attribute value of given type and name or null if no such attribute exists.
     */
    getAttributeValue(type, name) {
        const attr = this.getAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {string|null} attribute value of given type and name or null if no such attribute exists.
     */
    getOwnedAttributeValue(type, name) {
        const attr = this.getOwnedAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Attribute[]} all note's labels (attributes with type label), including inherited ones
     */
    getLabels(name) {
        return this.getAttributes(LABEL, name);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {string[]} all note's label values, including inherited ones
     */
    getLabelValues(name) {
        return this.getLabels(name).map(l => l.value);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Attribute[]} all note's labels (attributes with type label), excluding inherited ones
     */
    getOwnedLabels(name) {
        return this.getOwnedAttributes(LABEL, name);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {string[]} all note's label values, excluding inherited ones
     */
    getOwnedLabelValues(name) {
        return this.getOwnedAttributes(LABEL, name).map(l => l.value);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Attribute[]} all note's relations (attributes with type relation), including inherited ones
     */
    getRelations(name) {
        return this.getAttributes(RELATION, name);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Attribute[]} all note's relations (attributes with type relation), excluding inherited ones
     */
    getOwnedRelations(name) {
        return this.getOwnedAttributes(RELATION, name);
    }

    /**
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {Attribute[]} note's "owned" attributes - excluding inherited ones
     */
    getOwnedAttributes(type, name) {
        if (type && name) {
            return this.ownedAttributes.filter(attr => attr.type === type && attr.name === name);
        }
        else if (type) {
            return this.ownedAttributes.filter(attr => attr.type === type);
        }
        else if (name) {
            return this.ownedAttributes.filter(attr => attr.name === name);
        }
        else {
            return this.ownedAttributes.slice();
        }
    }

    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    get hasInheritableOwnedArchivedLabel() {
        return !!this.ownedAttributes.find(attr => attr.type === 'label' && attr.name === 'archived' && attr.isInheritable);
    }

    // will sort the parents so that non-search & non-archived are first and archived at the end
    // this is done so that non-search & non-archived paths are always explored as first when looking for note path
    resortParents() {
        this.parentBranches.sort((a, b) =>
            a.branchId.startsWith('virt-')
            || a.parentNote.hasInheritableOwnedArchivedLabel ? 1 : -1);

        this.parents = this.parentBranches.map(branch => branch.parentNote);
    }

    /**
     * This is used for:
     * - fast searching
     * - note similarity evaluation
     *
     * @return {string} - returns flattened textual representation of note, prefixes and attributes
     */
    get flatText() {
        if (!this.flatTextCache) {
            this.flatTextCache = this.noteId + ' ' + this.type + ' ' + this.mime + ' ';

            for (const branch of this.parentBranches) {
                if (branch.prefix) {
                    this.flatTextCache += branch.prefix + ' ';
                }
            }

            this.flatTextCache += this.title + ' ';

            for (const attr of this.getAttributes()) {
                // it's best to use space as separator since spaces are filtered from the search string by the tokenization into words
                this.flatTextCache += (attr.type === 'label' ? '#' : '~') + attr.name;

                if (attr.value) {
                    this.flatTextCache += '=' + attr.value;
                }

                this.flatTextCache += ' ';
            }

            this.flatTextCache = this.flatTextCache.toLowerCase();
        }

        return this.flatTextCache;
    }

    invalidateThisCache() {
        this.flatTextCache = null;

        this.__attributeCache = null;
        this.inheritableAttributeCache = null;
        this.ancestorCache = null;
    }

    invalidateSubTree(path = []) {
        if (path.includes(this.noteId)) {
            return;
        }

        this.invalidateThisCache();

        if (this.children.length || this.targetRelations.length) {
            path = [...path, this.noteId];
        }

        for (const childNote of this.children) {
            childNote.invalidateSubTree(path);
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    note.invalidateSubTree(path);
                }
            }
        }
    }

    invalidateSubtreeFlatText() {
        this.flatTextCache = null;

        for (const childNote of this.children) {
            childNote.invalidateSubtreeFlatText();
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    note.invalidateSubtreeFlatText();
                }
            }
        }
    }

    get isTemplate() {
        return !!this.targetRelations.find(rel => rel.name === 'template');
    }

    /** @return {Note[]} */
    get subtreeNotesIncludingTemplated() {
        const arr = [[this]];

        for (const childNote of this.children) {
            arr.push(childNote.subtreeNotesIncludingTemplated);
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    arr.push(note.subtreeNotesIncludingTemplated);
                }
            }
        }

        return arr.flat();
    }

    /** @return {Note[]} */
    get subtreeNotes() {
        const arr = [[this]];

        for (const childNote of this.children) {
            arr.push(childNote.subtreeNotes);
        }

        return arr.flat();
    }

    /** @return {String[]} */
    get subtreeNoteIds() {
        return this.subtreeNotes.map(note => note.noteId);
    }

    getDescendantNoteIds() {
        return this.subtreeNoteIds;
    }

    get parentCount() {
        return this.parents.length;
    }

    get childrenCount() {
        return this.children.length;
    }

    get labelCount() {
        return this.getAttributes().filter(attr => attr.type === 'label').length;
    }

    get ownedLabelCount() {
        return this.ownedAttributes.filter(attr => attr.type === 'label').length;
    }

    get relationCount() {
        return this.getAttributes().filter(attr => attr.type === 'relation' && !attr.isAutoLink()).length;
    }

    get relationCountIncludingLinks() {
        return this.getAttributes().filter(attr => attr.type === 'relation').length;
    }

    get ownedRelationCount() {
        return this.ownedAttributes.filter(attr => attr.type === 'relation' && !attr.isAutoLink()).length;
    }

    get ownedRelationCountIncludingLinks() {
        return this.ownedAttributes.filter(attr => attr.type === 'relation').length;
    }

    get targetRelationCount() {
        return this.targetRelations.filter(attr => !attr.isAutoLink()).length;
    }

    get targetRelationCountIncludingLinks() {
        return this.targetRelations.length;
    }

    get attributeCount() {
        return this.getAttributes().length;
    }

    get ownedAttributeCount() {
        return this.getAttributes().length;
    }

    get ancestors() {
        if (!this.ancestorCache) {
            const noteIds = new Set();
            this.ancestorCache = [];

            for (const parent of this.parents) {
                if (!noteIds.has(parent.noteId)) {
                    this.ancestorCache.push(parent);
                    noteIds.add(parent.noteId);
                }

                for (const ancestorNote of parent.ancestors) {
                    if (!noteIds.has(ancestorNote.noteId)) {
                        this.ancestorCache.push(ancestorNote);
                        noteIds.add(ancestorNote.noteId);
                    }
                }
            }
        }

        return this.ancestorCache;
    }

    /** @return {Note[]} - returns only notes which are templated, does not include their subtrees
     *                     in effect returns notes which are influenced by note's non-inheritable attributes */
    get templatedNotes() {
        const arr = [this];

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    arr.push(note);
                }
            }
        }

        return arr;
    }

    getDistanceToAncestor(ancestorNoteId) {
        if (this.noteId === ancestorNoteId) {
            return 0;
        }

        let minDistance = 999999;

        for (const parent of this.parents) {
            minDistance = Math.min(minDistance, parent.getDistanceToAncestor(ancestorNoteId) + 1);
        }

        return minDistance;
    }

    getNoteRevisions() {
        return sql.getRows("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId])
            .map(row => new NoteRevision(row));
    }

    decrypt() {
        if (this.isProtected && !this.isDecrypted && protectedSessionService.isProtectedSessionAvailable()) {
            try {
                this.title = protectedSessionService.decryptString(this.title);

                this.isDecrypted = true;
            }
            catch (e) {
                log.error(`Could not decrypt note ${this.noteId}: ${e.message} ${e.stack}`);
            }
        }
    }

    beforeSaving() {
        super.beforeSaving();

        this.dateModified = dateUtils.localNowDateTime();
        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        const pojo = {
            noteId: this.noteId,
            title: this.title,
            isProtected: this.isProtected,
            type: this.type,
            mime: this.mime,
            dateCreated: this.dateCreated,
            dateModified: this.dateModified,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified
        };

        if (pojo.isProtected) {
            if (this.isDecrypted) {
                pojo.title = protectedSessionService.encrypt(pojo.title);
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertexts
                delete pojo.title;
            }
        }

        return pojo;
    }
}

module.exports = Note;
