"use strict";

const utils = require('../../services/utils');
const sql = require('../../services/sql');
const entityChangesService = require('../../services/entity_changes');
const eventService = require("../../services/events");
const dateUtils = require("../../services/date_utils");
const cls = require("../../services/cls");
const log = require("../../services/log");

let becca = null;

/**
 * Base class for all backend entities.
 */
class AbstractEntity {
    /** @protected */
    beforeSaving() {
        this.generateIdIfNecessary();
    }

    /** @protected */
    generateIdIfNecessary() {
        if (!this[this.constructor.primaryKeyName]) {
            this[this.constructor.primaryKeyName] = utils.newEntityId();
        }
    }

    /** @protected */
    generateHash(isDeleted = false) {
        let contentToHash = "";

        for (const propertyName of this.constructor.hashedProperties) {
            contentToHash += `|${this[propertyName]}`;
        }

        if (isDeleted) {
            contentToHash += "|deleted";
        }

        return utils.hash(contentToHash).substr(0, 10);
    }

    /** @protected */
    getUtcDateChanged() {
        return this.utcDateModified || this.utcDateCreated;
    }

    /**
     * @protected
     * @returns {Becca}
     */
    get becca() {
        if (!becca) {
            becca = require('../becca');
        }

        return becca;
    }

    /** @protected */
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

    /** @protected */
    getPojoToSave() {
        return this.getPojo();
    }

    /**
     * Saves entity - executes SQL, but doesn't commit the transaction on its own
     *
     * @returns {this}
     */
    save(opts = {}) {
        const entityName = this.constructor.entityName;
        const primaryKeyName = this.constructor.primaryKeyName;

        const isNewEntity = !this[primaryKeyName];

        if (this.beforeSaving) {
            this.beforeSaving(opts);
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

    /**
     * Mark the entity as (soft) deleted. It will be completely erased later.
     *
     * This is a low level method, for notes and branches use `note.deleteNote()` and 'branch.deleteBranch()` instead.
     *
     * @param [deleteId=null]
     */
    markAsDeleted(deleteId = null) {
        const entityId = this[this.constructor.primaryKeyName];
        const entityName = this.constructor.entityName;

        this.utcDateModified = dateUtils.utcNowDateTime();

        sql.execute(`UPDATE ${entityName} SET isDeleted = 1, deleteId = ?, utcDateModified = ?
                           WHERE ${this.constructor.primaryKeyName} = ?`,
            [deleteId, this.utcDateModified, entityId]);

        if (this.dateModified) {
            this.dateModified = dateUtils.localNowDateTime();

            sql.execute(`UPDATE ${entityName} SET dateModified = ? WHERE ${this.constructor.primaryKeyName} = ?`,
                [this.dateModified, entityId]);
        }

        log.info(`Marking ${entityName} ${entityId} as deleted`);

        this.addEntityChange(true);

        eventService.emit(eventService.ENTITY_DELETED, { entityName, entityId, entity: this });
    }

    markAsDeletedSimple() {
        const entityId = this[this.constructor.primaryKeyName];
        const entityName = this.constructor.entityName;

        this.utcDateModified = dateUtils.utcNowDateTime();

        sql.execute(`UPDATE ${entityName} SET isDeleted = 1, utcDateModified = ?
                           WHERE ${this.constructor.primaryKeyName} = ?`,
            [this.utcDateModified, entityId]);

        log.info(`Marking ${entityName} ${entityId} as deleted`);

        this.addEntityChange(true);

        eventService.emit(eventService.ENTITY_DELETED, { entityName, entityId, entity: this });
    }
}

module.exports = AbstractEntity;
