"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');

class Attribute extends Entity {
    static get tableName() { return "attributes"; }
    static get primaryKeyName() { return "attributeId"; }
    static get hashedProperties() { return ["attributeId", "noteId", "type", "name", "value", "isInheritable", "dateModified", "dateCreated"]; }

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

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    isDefinition() {
        return this.type === 'label-definition' || this.type === 'relation-definition';
    }

    async beforeSaving() {
        if (!this.value) {
            // null value isn't allowed
            this.value = "";
        }

        if (this.position === undefined) {
            this.position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM attributes WHERE noteId = ?`, [this.noteId]);
        }

        if (!this.isInheritable) {
            this.isInheritable = false;
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        this.dateModified = dateUtils.nowDate();

        super.beforeSaving();
    }
}

module.exports = Attribute;