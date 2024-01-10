"use strict";

const sql = require('../../sql.js');
const utils = require('../../../services/utils.js');
const AbstractShacaEntity = require('./abstract_shaca_entity.js');
const escape = require('escape-html');

const LABEL = 'label';
const RELATION = 'relation';
const CREDENTIALS = 'shareCredentials';

const isCredentials = attr => attr.type === 'label' && attr.name === CREDENTIALS;

class SNote extends AbstractShacaEntity {
    constructor([noteId, title, type, mime, blobId, utcDateModified, isProtected]) {
        super();

        /** @param {string} */
        this.noteId = noteId;
        /** @param {string} */
        this.title = isProtected ? "[protected]" : title;
        /** @param {string} */
        this.type = type;
        /** @param {string} */
        this.mime = mime;
        /** @param {string} */
        this.blobId = blobId;
        /** @param {string} */
        this.utcDateModified = utcDateModified; // used for caching of images
        /** @param {boolean} */
        this.isProtected = isProtected;

        /** @param {SBranch[]} */
        this.parentBranches = [];
        /** @param {SNote[]} */
        this.parents = [];
        /** @param {SNote[]} */
        this.children = [];
        /** @param {SAttribute[]} */
        this.ownedAttributes = [];

        /** @param {SAttribute[]|null} */
        this.__attributeCache = null;
        /** @param {SAttribute[]|null} */
        this.__inheritableAttributeCache = null;

        /** @param {SAttribute[]} */
        this.targetRelations = [];

        /** @param {SAttachment[]} */
        this.attachments = [];

        this.shaca.notes[this.noteId] = this;
    }

    /** @returns {SBranch[]} */
    getParentBranches() {
        return this.parentBranches;
    }

    /** @returns {SBranch[]} */
    getBranches() {
        return this.parentBranches;
    }

    /** @returns {SBranch[]} */
    getChildBranches() {
        return this.children.map(childNote => this.shaca.getBranchFromChildAndParent(childNote.noteId, this.noteId));
    }

    /** @returns {SBranch[]} */
    getVisibleChildBranches() {
        return this.getChildBranches()
            .filter(branch => !branch.isHidden
                && !branch.getNote().isLabelTruthy('shareHiddenFromTree'));
    }

    /** @returns {SNote[]} */
    getParentNotes() {
        return this.parents;
    }

    /** @returns {SNote[]} */
    getChildNotes() {
        return this.children;
    }

    /** @returns {SNote[]} */
    getVisibleChildNotes() {
        return this.getVisibleChildBranches()
            .map(branch => branch.getNote());
    }

    /** @returns {boolean} */
    hasChildren() {
        return this.children && this.children.length > 0;
    }

    /** @returns {boolean} */
    hasVisibleChildren() {
        return this.getVisibleChildNotes().length > 0;
    }

    getContent(silentNotFoundError = false) {
        const row = sql.getRow(`SELECT content FROM blobs WHERE blobId = ?`, [this.blobId]);

        if (!row) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error(`Cannot find note content for note '${this.noteId}', blob '${this.blobId}'`);
            }
        }

        let content = row.content;

        if (this.hasStringContent()) {
            return content === null
                ? ""
                : content.toString("utf-8");
        }
        else {
            return content;
        }
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    hasStringContent() {
        return utils.isStringNote(this.type, this.mime);
    }

    /**
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {SAttribute[]} all note's attributes, including inherited ones
     */
    getAttributes(type, name) {
        if (!this.__attributeCache) {
            this.__getAttributes([]);
        }

        if (type && name) {
            return this.__attributeCache.filter(attr => attr.type === type && attr.name === name && !isCredentials(attr));
        }
        else if (type) {
            return this.__attributeCache.filter(attr => attr.type === type && !isCredentials(attr));
        }
        else if (name) {
            return this.__attributeCache.filter(attr => attr.name === name && !isCredentials(attr));
        }
        else {
            return this.__attributeCache.filter(attr => !isCredentials(attr));
        }
    }

    /** @returns {SAttribute[]} */
    getCredentials() {
        this.__getAttributes([]);

        return this.__attributeCache.filter(isCredentials);
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
                if (ownedAttr.type === 'relation' && ['template', 'inherit'].includes(ownedAttr.name)) {
                    const templateNote = this.shaca.notes[ownedAttr.value];

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

            this.__inheritableAttributeCache = [];

            for (const attr of this.__attributeCache) {
                if (attr.isInheritable) {
                    this.__inheritableAttributeCache.push(attr);
                }
            }
        }

        return this.__attributeCache;
    }

    /** @returns {SAttribute[]} */
    __getInheritableAttributes(path) {
        if (path.includes(this.noteId)) {
            return [];
        }

        if (!this.__inheritableAttributeCache) {
            this.__getAttributes(path); // will refresh also this.__inheritableAttributeCache
        }

        return this.__inheritableAttributeCache;
    }

    /** @returns {boolean} */
    hasAttribute(type, name) {
        return !!this.getAttributes().find(attr => attr.type === type && attr.name === name);
    }

    /** @returns {SNote|null} */
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
     * @returns {boolean} true if label exists (including inherited) and does not have "false" value.
     */
    isLabelTruthy(name) {
        const label = this.getLabel(name);

        if (!label) {
            return false;
        }

        return label && label.value !== 'false';
    }

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
     * @returns {SAttribute|null} label if it exists, null otherwise
     */
    getLabel(name) { return this.getAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {SAttribute|null} label if it exists, null otherwise
     */
    getOwnedLabel(name) { return this.getOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {SAttribute|null} relation if it exists, null otherwise
     */
    getRelation(name) { return this.getAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {SAttribute|null} relation if it exists, null otherwise
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
     * @returns {SAttribute} attribute of the given type and name. If there are more such attributes, first is  returned.
     *                       Returns null if there's no such attribute belonging to this note.
     */
    getAttribute(type, name) {
        const attributes = this.getAttributes();

        return attributes.find(attr => attr.type === type && attr.name === name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {string|null} attribute value of the given type and name or null if no such attribute exists.
     */
    getAttributeValue(type, name) {
        const attr = this.getAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {string|null} attribute value of the given type and name or null if no such attribute exists.
     */
    getOwnedAttributeValue(type, name) {
        const attr = this.getOwnedAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {SAttribute[]} all note's labels (attributes with type label), including inherited ones
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
     * @returns {SAttribute[]} all note's labels (attributes with type label), excluding inherited ones
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
     * @returns {SAttribute[]} all note's relations (attributes with type relation), including inherited ones
     */
    getRelations(name) {
        return this.getAttributes(RELATION, name);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {SAttribute[]} all note's relations (attributes with type relation), excluding inherited ones
     */
    getOwnedRelations(name) {
        return this.getOwnedAttributes(RELATION, name);
    }

    /**
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {SAttribute[]} note's "owned" attributes - excluding inherited ones
     */
    getOwnedAttributes(type, name) {
        // it's a common mistake to include # or ~ into attribute name
        if (name && ["#", "~"].includes(name[0])) {
            name = name.substr(1);
        }

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

    /**
     * @returns {SAttribute} attribute belonging to this specific note (excludes inherited attributes)
     *
     * This method can be significantly faster than the getAttribute()
     */
    getOwnedAttribute(type, name) {
        const attrs = this.getOwnedAttributes(type, name);

        return attrs.length > 0 ? attrs[0] : null;
    }

    /** @returns {boolean} */
    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    /** @returns {boolean} */
    isInherited() {
        return !!this.targetRelations.find(rel => rel.name === 'template' || rel.name === 'inherit');
    }

    /** @returns {SAttribute[]} */
    getTargetRelations() {
        return this.targetRelations;
    }

    /** @returns {SAttachment[]} */
    getAttachments() {
        return this.attachments;
    }

    /** @returns {SAttachment} */
    getAttachmentByTitle(title) {
        return this.attachments.find(attachment => attachment.title === title);
    }

    /** @returns {string} */
    get shareId() {
        if (this.hasOwnedLabel('shareRoot')) {
            return "";
        }

        const sharedAlias = this.getOwnedLabelValue("shareAlias");

        return sharedAlias || this.noteId;
    }

    get escapedTitle() {
        return escape(this.title);
    }

    get encodedTitle() {
        return encodeURIComponent(this.title);
    }

    getPojo() {
        return {
            noteId: this.noteId,
            title: this.title,
            type: this.type,
            mime: this.mime,
            utcDateModified: this.utcDateModified,
            attributes: this.getAttributes()
                // relations could link across shared subtrees which might leak them
                // individual relations might be whitelisted based on needs #3434
                .filter(attr => attr.type === 'label')
                .map(attr => attr.getPojo()),
            attachments: this.getAttachments()
                .map(attachment => attachment.getPojo()),
            parentNoteIds: this.parents.map(parentNote => parentNote.noteId),
            childNoteIds: this.children.map(child => child.noteId)
        };
    }
}

module.exports = SNote;
