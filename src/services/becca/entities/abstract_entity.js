"use strict";

const utils = require('../../utils');
const sql = require('../../sql');
const entityChangesService = require('../../entity_changes');
const eventService = require("../../events");
const dateUtils = require("../../date_utils");
const cls = require("../../cls");

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
        // FIXME
        return this.utcDateModified || this.utcDateCreated || "FAKE";
    }

    get becca() {
        if (!becca) {
            becca = require('../becca');
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

    save() {
        const entityName = this.constructor.entityName;
        const primaryKeyName = this.constructor.primaryKeyName;

        const isNewEntity = !this[primaryKeyName];

        if (this.beforeSaving) {
            this.beforeSaving();
        }

        const pojo = this.getPojo();

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

        eventService.emit(eventService.ENTITY_DELETED, { entityName, entity: this });
    }
}

module.exports = AbstractEntity;
