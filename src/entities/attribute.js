"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');

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

        if (this.isDefinition()) {
            try {
                this.value = JSON.parse(this.value);
            }
            catch (e) {
            }
        }
    }

    /**
     * @returns {Promise<Note|null>}
     */
    getNote() {
        return this.repository.getNote(this.noteId);
    }

    /**
     * @returns {Promise<Note|null>}
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
        return this.type === 'label-definition' || this.type === 'relation-definition';
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

    // cannot be static!
    updatePojo(pojo) {
        delete pojo.__note; // FIXME: probably note necessary anymore
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
