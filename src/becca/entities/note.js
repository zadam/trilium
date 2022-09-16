"use strict";

const protectedSessionService = require('../../services/protected_session');
const log = require('../../services/log');
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const entityChangesService = require('../../services/entity_changes');
const AbstractEntity = require("./abstract_entity");
const NoteRevision = require("./note_revision");
const TaskContext = require("../../services/task_context");
const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)

const LABEL = 'label';
const RELATION = 'relation';

/**
 * Trilium's main entity which can represent text note, image, code note, file attachment etc.
 *
 * @extends AbstractEntity
 */
class Note extends AbstractEntity {
    static get entityName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }
    static get hashedProperties() { return ["noteId", "title", "isProtected", "type", "mime"]; }

    constructor(row) {
        super();

        if (!row) {
            return;
        }

        this.updateFromRow(row);
        this.init();
    }

    updateFromRow(row) {
        this.update([
            row.noteId,
            row.title,
            row.type,
            row.mime,
            row.isProtected,
            row.dateCreated,
            row.dateModified,
            row.utcDateCreated,
            row.utcDateModified
        ]);
    }

    update([noteId, title, type, mime, isProtected, dateCreated, dateModified, utcDateCreated, utcDateModified]) {
        // ------ Database persisted attributes ------

        /** @type {string} */
        this.noteId = noteId;
        /** @type {string} */
        this.title = title;
        /** @type {boolean} */
        this.isProtected = !!isProtected;
        /** @type {string} */
        this.type = type;
        /** @type {string} */
        this.mime = mime;
        /** @type {string} */
        this.dateCreated = dateCreated || dateUtils.localNowDateTime();
        /** @type {string} */
        this.dateModified = dateModified;
        /** @type {string} */
        this.utcDateCreated = utcDateCreated || dateUtils.utcNowDateTime();
        /** @type {string} */
        this.utcDateModified = utcDateModified;

        // ------ Derived attributes ------

        /** @type {boolean} */
        this.isDecrypted = !this.noteId || !this.isProtected;

        this.decrypt();

        /** @type {string|null} */
        this.flatTextCache = null;

        return this;
    }

    init() {
        /** @type {Branch[]}
         * @private */
        this.parentBranches = [];
        /** @type {Note[]}
         * @private */
        this.parents = [];
        /** @type {Note[]}
         * @private*/
        this.children = [];
        /** @type {Attribute[]}
         * @private */
        this.ownedAttributes = [];

        /** @type {Attribute[]|null}
         * @private */
        this.__attributeCache = null;
        /** @type {Attribute[]|null}
         * @private*/
        this.inheritableAttributeCache = null;

        /** @type {Attribute[]}
         * @private*/
        this.targetRelations = [];

        this.becca.addNote(this.noteId, this);

        /** @type {Note[]|null}
         * @private */
        this.ancestorCache = null;

        // following attributes are filled during searching from database

        /**
         * size of the content in bytes
         * @type {int|null}
         * @private
         */
        this.contentSize = null;
        /**
         * size of the content and note revision contents in bytes
         * @type {int|null}
         * @private
         */
        this.noteSize = null;
        /**
         * number of note revisions for this note
         * @type {int|null}
         * @private
         */
        this.revisionCount = null;
    }

    isContentAvailable() {
        return !this.noteId // new note which was not encrypted yet
            || !this.isProtected
            || protectedSessionService.isProtectedSessionAvailable()
    }

    getTitleOrProtected() {
        return this.isContentAvailable() ? this.title : '[protected]';
    }

    /** @returns {Branch[]} */
    getParentBranches() {
        return this.parentBranches;
    }

    /**
     * @returns {Branch[]}
     * @deprecated use getParentBranches() instead
     */
    getBranches() {
        return this.parentBranches;
    }

    /** @returns {Note[]} */
    getParentNotes() {
        return this.parents;
    }

    /** @returns {Note[]} */
    getChildNotes() {
        return this.children;
    }

    /** @returns {boolean} */
    hasChildren() {
        return this.children && this.children.length > 0;
    }

    /** @returns {Branch[]} */
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

    get dateCreatedObj() {
        return this.dateCreated === null ? null : dayjs(this.dateCreated);
    }

    get utcDateCreatedObj() {
        return this.utcDateCreated === null ? null : dayjs.utc(this.utcDateCreated);
    }

    get dateModifiedObj() {
        return this.dateModified === null ? null : dayjs(this.dateModified);
    }

    get utcDateModifiedObj() {
        return this.utcDateModified === null ? null : dayjs.utc(this.utcDateModified);
    }

    /** @returns {*} */
    getJsonContent() {
        const content = this.getContent();

        if (!content || !content.trim()) {
            return null;
        }

        return JSON.parse(content);
    }

    setContent(content, ignoreMissingProtectedSession = false) {
        if (content === null || content === undefined) {
            throw new Error(`Cannot set null content to note '${this.noteId}'`);
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
            else if (!ignoreMissingProtectedSession) {
                throw new Error(`Cannot update content of noteId '${this.noteId}' since we're out of protected session.`);
            }
        }

        sql.upsert("note_contents", "noteId", pojo);

        const hash = utils.hash(this.noteId + "|" + pojo.content.toString());

        entityChangesService.addEntityChange({
            entityName: 'note_contents',
            entityId: this.noteId,
            hash: hash,
            isErased: false,
            utcDateChanged: pojo.utcDateModified,
            isSynced: true
        });
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

    /** @private */
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
                        templateAttributes.push(
                            ...templateNote.__getAttributes(newPath)
                                // template attr is used as a marker for templates, but it's not meant to be inherited
                                .filter(attr => !(attr.type === 'label' && (attr.name === 'template' || attr.name === 'workspacetemplate')))
                        );
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

    /**
     * @private
     * @returns {Attribute[]}
     */
    __getInheritableAttributes(path) {
        if (path.includes(this.noteId)) {
            return [];
        }

        if (!this.inheritableAttributeCache) {
            this.__getAttributes(path); // will refresh also this.inheritableAttributeCache
        }

        return this.inheritableAttributeCache;
    }

    /**
     * @param type
     * @param name
     * @param [value]
     * @returns {boolean}
     */
    hasAttribute(type, name, value) {
        return !!this.getAttributes().find(attr =>
            attr.type === type
            && attr.name === name
            && (value === undefined || value === null || attr.value === value)
        );
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
     * @param {string} [value] - label value
     * @returns {boolean} true if label exists (including inherited)
     */
    hasLabel(name, value) { return this.hasAttribute(LABEL, name, value); }

    /**
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {boolean} true if label exists (excluding inherited)
     */
    hasOwnedLabel(name, value) { return this.hasOwnedAttribute(LABEL, name, value); }

    /**
     * @param {string} name - relation name
     * @param {string} [value] - relation value
     * @returns {boolean} true if relation exists (including inherited)
     */
    hasRelation(name, value) { return this.hasAttribute(RELATION, name, value); }

    /**
     * @param {string} name - relation name
     * @param {string} [value] - relation value
     * @returns {boolean} true if relation exists (excluding inherited)
     */
    hasOwnedRelation(name, value) { return this.hasOwnedAttribute(RELATION, name, value); }

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
     * @param {string} [value] - attribute value
     * @returns {boolean} true if note has an attribute with given type and name (excluding inherited)
     */
    hasOwnedAttribute(type, name, value) {
        return !!this.getOwnedAttribute(type, name, value);
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
     * @param {string} [value] - (optional) attribute value to filter
     * @returns {Attribute[]} note's "owned" attributes - excluding inherited ones
     */
    getOwnedAttributes(type, name, value) {
        // it's a common mistake to include # or ~ into attribute name
        if (name && ["#", "~"].includes(name[0])) {
            name = name.substr(1);
        }

        if (type && name && value !== undefined && value !== null) {
            return this.ownedAttributes.filter(attr => attr.type === type && attr.name === name && attr.value === value);
        }
        else if (type && name) {
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

    /**
     * @returns {Attribute} attribute belonging to this specific note (excludes inherited attributes)
     *
     * This method can be significantly faster than the getAttribute()
     */
    getOwnedAttribute(type, name, value) {
        const attrs = this.getOwnedAttributes(type, name, value);

        return attrs.length > 0 ? attrs[0] : null;
    }

    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    hasInheritableOwnedArchivedLabel() {
        return !!this.ownedAttributes.find(attr => attr.type === 'label' && attr.name === 'archived' && attr.isInheritable);
    }

    // will sort the parents so that non-search & non-archived are first and archived at the end
    // this is done so that non-search & non-archived paths are always explored as first when looking for note path
    sortParents() {
        this.parentBranches.sort((a, b) =>
            a.branchId.startsWith('virt-')
            || a.parentNote?.hasInheritableOwnedArchivedLabel() ? 1 : -1);

        this.parents = this.parentBranches
            .map(branch => branch.parentNote)
            .filter(note => !!note);
    }

    /**
     * This is used for:
     * - fast searching
     * - note similarity evaluation
     *
     * @return {string} - returns flattened textual representation of note, prefixes and attributes
     */
    getFlatText() {
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

            this.flatTextCache = utils.normalize(this.flatTextCache);
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

    getRelationDefinitions() {
        return this.getLabels()
            .filter(l => l.name.startsWith("relation:"));
    }

    getLabelDefinitions() {
        return this.getLabels()
            .filter(l => l.name.startsWith("relation:"));
    }

    isTemplate() {
        return !!this.targetRelations.find(rel => rel.name === 'template');
    }

    /** @returns {Note[]} */
    getSubtreeNotesIncludingTemplated() {
        const set = new Set();

        function inner(note) {
            if (set.has(note)) {
                return;
            }

            set.add(note);

            for (const childNote of note.children) {
                inner(childNote);
            }

            for (const targetRelation of note.targetRelations) {
                if (targetRelation.name === 'template') {
                    const targetNote = targetRelation.note;

                    if (targetNote) {
                        inner(targetNote);
                    }
                }
            }
        }

        inner(this);

        return Array.from(set);
    }

    /** @returns {Note[]} */
    getSubtreeNotes(includeArchived = true) {
        const noteSet = new Set();

        function addSubtreeNotesInner(note) {
            if (!includeArchived && note.isArchived) {
                return;
            }

            noteSet.add(note);

            for (const childNote of note.children) {
                addSubtreeNotesInner(childNote);
            }
        }

        addSubtreeNotesInner(this);

        return Array.from(noteSet);
    }

    /** @returns {String[]} */
    getSubtreeNoteIds(includeArchived = true) {
        return this.getSubtreeNotes(includeArchived).map(note => note.noteId);
    }

    getDescendantNoteIds() {
        return this.getSubtreeNoteIds();
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

    /** @returns {Note[]} */
    getAncestors() {
        if (!this.ancestorCache) {
            const noteIds = new Set();
            this.ancestorCache = [];

            for (const parent of this.parents) {
                if (noteIds.has(parent.noteId)) {
                    continue;
                }

                this.ancestorCache.push(parent);
                noteIds.add(parent.noteId);

                for (const ancestorNote of parent.getAncestors()) {
                    if (!noteIds.has(ancestorNote.noteId)) {
                        this.ancestorCache.push(ancestorNote);
                        noteIds.add(ancestorNote.noteId);
                    }
                }
            }
        }

        return this.ancestorCache;
    }

    /** @returns {boolean} */
    hasAncestor(ancestorNoteId) {
        for (const ancestorNote of this.getAncestors()) {
            if (ancestorNote.noteId === ancestorNoteId) {
                return true;
            }
        }

        return false;
    }

    getTargetRelations() {
        return this.targetRelations;
    }

    /** @returns {Note[]} - returns only notes which are templated, does not include their subtrees
     *                     in effect returns notes which are influenced by note's non-inheritable attributes */
    getTemplatedNotes() {
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

    /**
     * @return {string[][]} - array of notePaths (each represented by array of noteIds constituting the particular note path)
     */
    getAllNotePaths() {
        if (this.noteId === 'root') {
            return [['root']];
        }

        const notePaths = [];

        for (const parentNote of this.getParentNotes()) {
            for (const parentPath of parentNote.getAllNotePaths()) {
                parentPath.push(this.noteId);
                notePaths.push(parentPath);
            }
        }

        return notePaths;
    }

    /**
     * @param ancestorNoteId
     * @return {boolean} - true if ancestorNoteId occurs in at least one of the note's paths
     */
    isDescendantOfNote(ancestorNoteId) {
        const notePaths = this.getAllNotePaths();

        return notePaths.some(path => path.includes(ancestorNoteId));
    }

    /**
     * Update's given attribute's value or creates it if it doesn't exist
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     */
    setAttribute(type, name, value) {
        const attributes = this.getOwnedAttributes();
        const attr = attributes.find(attr => attr.type === type && attr.name === name);

        value = value !== null && value !== undefined ? value.toString() : "";

        if (attr) {
            if (attr.value !== value) {
                attr.value = value;
                attr.save();
            }
        }
        else {
            const Attribute = require("./attribute");

            new Attribute({
                noteId: this.noteId,
                type: type,
                name: name,
                value: value
            }).save();
        }
    }

    /**
     * Removes given attribute name-value pair if it exists.
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     */
    removeAttribute(type, name, value) {
        const attributes = this.getOwnedAttributes();

        for (const attribute of attributes) {
            if (attribute.type === type && attribute.name === name && (value === undefined || value === attribute.value)) {
                attribute.markAsDeleted();
            }
        }
    }

    /**
     * Adds a new attribute to this note. The attribute is saved and returned.
     * See addLabel, addRelation for more specific methods.
     *
     * @param {string} type - attribute type (label / relation)
     * @param {string} name - name of the attribute, not including the leading ~/#
     * @param {string} [value] - value of the attribute - text for labels, target note ID for relations; optional.
     *
     * @return {Attribute}
     */
    addAttribute(type, name, value = "", isInheritable = false, position = 1000) {
        const Attribute = require("./attribute");

        return new Attribute({
            noteId: this.noteId,
            type: type,
            name: name,
            value: value,
            isInheritable: isInheritable,
            position: position
        }).save();
    }

    /**
     * Adds a new label to this note. The label attribute is saved and returned.
     *
     * @param {string} name - name of the label, not including the leading #
     * @param {string} [value] - text value of the label; optional
     *
     * @return {Attribute}
     */
    addLabel(name, value = "", isInheritable = false) {
        return this.addAttribute(LABEL, name, value, isInheritable);
    }

    /**
     * Adds a new relation to this note. The relation attribute is saved and
     * returned.
     *
     * @param {string} name - name of the relation, not including the leading ~
     * @param {string} value - ID of the target note of the relation
     *
     * @return {Attribute}
     */
    addRelation(name, targetNoteId, isInheritable = false) {
        return this.addAttribute(RELATION, name, targetNoteId, isInheritable);
    }

    /**
     * Based on enabled, attribute is either set or removed.
     *
     * @param {string} type - attribute type ('relation', 'label' etc.)
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     */
    toggleAttribute(type, enabled, name, value) {
        if (enabled) {
            this.setAttribute(type, name, value);
        }
        else {
            this.removeAttribute(type, name, value);
        }
    }

    /**
     * Based on enabled, label is either set or removed.
     *
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - label name
     * @param {string} [value] - label value (optional)
     */
    toggleLabel(enabled, name, value) { return this.toggleAttribute(LABEL, enabled, name, value); }

    /**
     * Based on enabled, relation is either set or removed.
     *
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     */
    toggleRelation(enabled, name, value) { return this.toggleAttribute(RELATION, enabled, name, value); }

    /**
     * Update's given label's value or creates it if it doesn't exist
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     */
    setLabel(name, value) { return this.setAttribute(LABEL, name, value); }

    /**
     * Update's given relation's value or creates it if it doesn't exist
     *
     * @param {string} name - relation name
     * @param {string} value - relation value (noteId)
     */
    setRelation(name, value) { return this.setAttribute(RELATION, name, value); }

    /**
     * Remove label name-value pair, if it exists.
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     */
    removeLabel(name, value) { return this.removeAttribute(LABEL, name, value); }

    /**
     * Remove relation name-value pair, if it exists.
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     */
    removeRelation(name, value) { return this.removeAttribute(RELATION, name, value); }

    searchNotesInSubtree(searchString) {
        const searchService = require("../../services/search/services/search");

        return searchService.searchNotes(searchString);
    }

    searchNoteInSubtree(searchString) {
        return this.searchNotesInSubtree(searchString)[0];
    }

    /**
     * @param parentNoteId
     * @returns {{success: boolean, message: string}}
     */
    cloneTo(parentNoteId) {
        const cloningService = require("../../services/cloning");

        const branch = this.becca.getNote(parentNoteId).getParentBranches()[0];

        return cloningService.cloneNoteToBranch(this.noteId, branch.branchId);
    }

    /**
     * (Soft) delete a note and all its descendants.
     *
     * @param {string} [deleteId] - optional delete identified
     * @param {TaskContext} [taskContext]
     */
    deleteNote(deleteId, taskContext) {
        if (this.isDeleted) {
            return;
        }

        if (!deleteId) {
            deleteId = utils.randomString(10);
        }

        if (!taskContext) {
            taskContext = new TaskContext('no-progress-reporting');
        }

        // needs to be run before branches and attributes are deleted and thus attached relations disappear
        const handlers = require("../../services/handlers");
        handlers.runAttachedRelations(this, 'runOnNoteDeletion', this);
        taskContext.noteDeletionHandlerTriggered = true;

        for (const branch of this.getParentBranches()) {
            branch.deleteBranch(deleteId, taskContext);
        }
    }

    decrypt() {
        if (this.isProtected && !this.isDecrypted && protectedSessionService.isProtectedSessionAvailable()) {
            try {
                this.title = protectedSessionService.decryptString(this.title);
                this.flatTextCache = null;

                this.isDecrypted = true;
            }
            catch (e) {
                log.error(`Could not decrypt note ${this.noteId}: ${e.message} ${e.stack}`);
            }
        }
    }

    get isDeleted() {
        return !(this.noteId in this.becca.notes);
    }

    /**
     * @return {NoteRevision|null}
     */
    saveNoteRevision() {
        const content = this.getContent();

        if (!content || (Buffer.isBuffer(content) && content.byteLength === 0)) {
            return null;
        }

        const contentMetadata = this.getContentMetadata();

        const noteRevision = new NoteRevision({
            noteId: this.noteId,
            // title and text should be decrypted now
            title: this.title,
            type: this.type,
            mime: this.mime,
            isProtected: this.isProtected,
            utcDateLastEdited: this.utcDateModified > contentMetadata.utcDateModified
                ? this.utcDateModified
                : contentMetadata.utcDateModified,
            utcDateCreated: dateUtils.utcNowDateTime(),
            utcDateModified: dateUtils.utcNowDateTime(),
            dateLastEdited: this.dateModified > contentMetadata.dateModified
                ? this.dateModified
                : contentMetadata.dateModified,
            dateCreated: dateUtils.localNowDateTime()
        }, true).save();

        noteRevision.setContent(content);

        return noteRevision;
    }

    beforeSaving() {
        super.beforeSaving();

        this.becca.addNote(this.noteId, this);

        this.dateModified = dateUtils.localNowDateTime();
        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            noteId: this.noteId,
            title: this.title,
            isProtected: this.isProtected,
            type: this.type,
            mime: this.mime,
            isDeleted: false,
            dateCreated: this.dateCreated,
            dateModified: this.dateModified,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified
        };
    }

    getPojoToSave() {
        const pojo = this.getPojo();

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
