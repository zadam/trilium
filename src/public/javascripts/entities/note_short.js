import server from '../services/server.js';

const LABEL = 'label';
const LABEL_DEFINITION = 'label-definition';
const RELATION = 'relation';
const RELATION_DEFINITION = 'relation-definition';

/**
 * This note's representation is used in note tree and is kept in TreeCache.
 * Its notable omission is the note content.
 */
class NoteShort {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.title = row.title;
        /** @param {boolean} */
        this.isProtected = row.isProtected;
        /** @param {string} one of 'text', 'code', 'file' or 'render' */
        this.type = row.type;
        /** @param {string} content-type, e.g. "application/json" */
        this.mime = row.mime;
        /** @param {boolean} */
        this.archived = row.archived;
        this.cssClass = row.cssClass;
    }

    /** @returns {boolean} */
    isJson() {
        return this.mime === "application/json";
    }

    /** @returns {Promise<Branch[]>} */
    async getBranches() {
        const branchIds = this.treeCache.parents[this.noteId].map(
            parentNoteId => this.treeCache.getBranchIdByChildParent(this.noteId, parentNoteId));

        return this.treeCache.getBranches(branchIds);
    }

    /** @returns {boolean} */
    hasChildren() {
        return this.treeCache.children[this.noteId]
            && this.treeCache.children[this.noteId].length > 0;
    }

    /** @returns {Promise<Branch[]>} */
    async getChildBranches() {
        if (!this.treeCache.children[this.noteId]) {
            return [];
        }

        const branchIds = this.treeCache.children[this.noteId].map(
            childNoteId => this.treeCache.getBranchIdByChildParent(childNoteId, this.noteId));

        return await this.treeCache.getBranches(branchIds);
    }

    /** @returns {string[]} */
    getParentNoteIds() {
        return this.treeCache.parents[this.noteId] || [];
    }

    /** @returns {Promise<NoteShort[]>} */
    async getParentNotes() {
        return await this.treeCache.getNotes(this.getParentNoteIds());
    }

    /** @returns {string[]} */
    getChildNoteIds() {
        return this.treeCache.children[this.noteId] || [];
    }

    /** @returns {Promise<NoteShort[]>} */
    async getChildNotes() {
        return await this.treeCache.getNotes(this.getChildNoteIds());
    }

    /**
     * @param {string} [name] - attribute name to filter
     * @returns {Promise<Attribute[]>}
     */
    async getAttributes(name) {
        if (!this.attributeCache) {
            this.attributeCache = await server.get('notes/' + this.noteId + '/attributes');
        }

        if (name) {
            return this.attributeCache.filter(attr => attr.name === name);
        }
        else {
            return this.attributeCache;
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
     * @param {string} name
     * @returns {Promise<Note>|null} target note of the relation or null (if target is empty or note was not found)
     */
    async getRelationTarget(name) {
        const relation = await this.getRelation(name);

        return relation ? await repository.getNote(relation.value) : null;
    }

    /**
     * Clear note's attributes cache to force fresh reload for next attribute request.
     * Cache is note instance scoped.
     */
    invalidateAttributeCache() {
        this.attributeCache = null;
    }

    get toString() {
        return `Note(noteId=${this.noteId}, title=${this.title})`;
    }

    get dto() {
        const dto = Object.assign({}, this);
        delete dto.treeCache;
        delete dto.archived;
        delete dto.attributeCache;

        return dto;
    }
}

export default NoteShort;