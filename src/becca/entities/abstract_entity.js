"use strict";

const utils = require('../../services/utils');
const sql = require('../../services/sql');
const entityChangesService = require('../../services/entity_changes');
const eventService = require("../../services/events");
const dateUtils = require("../../services/date_utils");
const cls = require("../../services/cls");

let becca = null;

class AbstractEntity {
    beforeSaving() {
        this.generateIdIfNecessary();
    }

    generateIdIfNecessary() {
        if (!this[this.constructor.primaryKeyName]) {
            this[this.constructor.primaryKeyName] = utils.newEntityId();
        }
    }

    generateHash(isDeleted = false) {
        let contentToHash = "";

        for (const propertyName of this.constructor.hashedProperties) {
            contentToHash += "|" + this[propertyName];
        }

        if (isDeleted) {
            contentToHash += "|deleted";
        }

        return utils.hash(contentToHash).substr(0, 10);
    }

    getUtcDateChanged() {
        return this.utcDateModified || this.utcDateCreated;
    }

    get becca() {
        if (!becca) {
            becca = require('../becca.js');
        }

        return becca;
    }

    addEntityChange(isDeleted = false) {
        entityChangesService.addEntityChange({
            entityName: this.constructor.entityName,
            entityId: this[this.constructor.primaryKeyName],
            hash: this.generateHash(isDeleted),
            isErased: false,
            utcDateChanged: this.getUtcDateChanged(),
            isSynced: this.constructor.entityName !== 'options' || !!this.isSynced
        });
    }

    getPojoToSave() {
        return this.getPojo();
    }

    save() {
        const entityName = this.constructor.entityName;
        const primaryKeyName = this.constructor.primaryKeyName;

        const isNewEntity = !this[primaryKeyName];

        if (this.beforeSaving) {
            this.beforeSaving();
        }

        const pojo = this.getPojoToSave();

        sql.transactional(() => {
            sql.upsert(entityName, primaryKeyName, pojo);

            if (entityName === 'recent_notes') {
                return;
            }

            this.addEntityChange(false);

            if (!cls.isEntityEventsDisabled()) {
                const eventPayload = {
                    entityName,
                    entity: this
                };

                if (isNewEntity) {
                    eventService.emit(eventService.ENTITY_CREATED, eventPayload);
                }

                eventService.emit(eventService.ENTITY_CHANGED, eventPayload);
            }
        });

        return this;
    }

    markAsDeleted(deleteId = null) {
        const entityId = this[this.constructor.primaryKeyName];
        const entityName = this.constructor.entityName;

        sql.execute(`UPDATE ${entityName} SET isDeleted = 1, deleteId = ?, utcDateModified = ?
                           WHERE ${this.constructor.primaryKeyName} = ?`,
            [deleteId, dateUtils.utcNowDateTime(), entityId]);

        if (this.dateModified) {
            sql.execute(`UPDATE ${entityName} SET dateModified = ? WHERE ${this.constructor.primaryKeyName} = ?`,
                [dateUtils.localNowDateTime(), entityId]);
        }

        this.addEntityChange(true);

        eventService.emit(eventService.ENTITY_DELETED, { entityName, entityId, entity: this });
    }
}

module.exports = AbstractEntity;
