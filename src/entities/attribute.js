"use strict";


const Entity = require('./entity');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');
const promotedAttributeDefinitionParser = require("../services/promoted_attribute_definition_parser");

/**
 * Attribute is key value pair owned by a note.
 *
 * @property {string} attributeId - immutable
 * @property {string} noteId - immutable
 * @property {string} type - immutable
 * @property {string} name - immutable
 * @property {string} value
 * @property {int} position
 * @property {boolean} isInheritable - immutable
 * @property {boolean} isDeleted
 * @property {string|null} deleteId - ID identifying delete transaction
 * @property {string} utcDateCreated
 * @property {string} utcDateModified
 *
 * @extends Entity
 */
class Attribute extends Entity {
    static get entityName() { return "attributes"; }
    static get primaryKeyName() { return "attributeId"; }
    static get hashedProperties() { return ["attributeId", "noteId", "type", "name", "value", "isInheritable", "isDeleted", "utcDateCreated"]; }

    constructor(row) {
        super(row);

        this.isInheritable = !!this.isInheritable;
    }

    /**
     * @returns {Note|null}
     */
    getNote() {
        return this.repository.getNote(this.noteId);
    }

    /**
     * @returns {Note|null}
     */
    getTargetNote() {
        if (this.type !== 'relation') {
            throw new Error(`Attribute ${this.attributeId} is not relation`);
        }

        if (!this.value) {
            return null;
        }

        return this.repository.getNote(this.value);
    }

    /**
     * @return {boolean}
     */
    isDefinition() {
        return this.type === 'label' && (this.name.startsWith('label:') || this.name.startsWith('relation:'));
    }

    getDefinition() {
        return promotedAttributeDefinitionParser.parse(this.value);
    }

    getDefinedName() {
        if (this.type === 'label' && this.name.startsWith('label:')) {
            return this.name.substr(6);
        } else if (this.type === 'label' && this.name.startsWith('relation:')) {
            return this.name.substr(9);
        } else {
            return this.name;
        }
    }

    beforeSaving() {
        if (!this.value) {
            if (this.type === 'relation') {
                throw new Error(`Cannot save relation ${this.name} since it does not target any note.`);
            }

            // null value isn't allowed
            this.value = "";
        }

        if (this.position === undefined) {
            this.position = 1 + sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM attributes WHERE noteId = ?`, [this.noteId]);
        }

        if (!this.isInheritable) {
            this.isInheritable = false;
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.utcDateModified = dateUtils.utcNowDateTime();
        }
    }

    createClone(type, name, value, isInheritable) {
        return new Attribute({
            noteId: this.noteId,
            type: type,
            name: name,
            value: value,
            position: this.position,
            isInheritable: isInheritable,
            isDeleted: false,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified
        });
    }
}

module.exports = Attribute;
