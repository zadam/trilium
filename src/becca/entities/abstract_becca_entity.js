"use strict";

const utils = require('../../services/utils');
const sql = require('../../services/sql');
const entityChangesService = require('../../services/entity_changes');
const eventService = require("../../services/events");
const dateUtils = require("../../services/date_utils");
const cls = require("../../services/cls");
const log = require("../../services/log");
const protectedSessionService = require("../../services/protected_session.js");

let becca = null;

/**
 * Base class for all backend entities.
 */
class AbstractBeccaEntity {
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
     * Hot entities keep stable blobId which is continuously updated and is not shared with other entities.
     * Cold entities can still update its blob, but the blobId will change (and new blob will be created).
     * Functionally this is the same, it's an optimization to avoid creating a new blob every second with auto saved
     * text notes.
     *
     * @protected
     */
    _isHot() {
        return false;
    }

    /** @protected */
    _setContent(content, opts = {}) {
        // client code asks to save entity even if blobId didn't change (something else was changed)
        opts.forceSave = !!opts.forceSave;
        opts.forceCold = !!opts.forceCold;
        opts.forceFrontendReload = !!opts.forceFrontendReload;

        if (content === null || content === undefined) {
            throw new Error(`Cannot set null content to ${this.constructor.primaryKeyName} '${this[this.constructor.primaryKeyName]}'`);
        }

        if (this.hasStringContent()) {
            content = content.toString();
        }
        else {
            content = Buffer.isBuffer(content) ? content : Buffer.from(content);
        }

        let unencryptedContentForHashCalculation = content;

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                content = protectedSessionService.encrypt(content);

                // this is to make sure that the calculated hash/blobId is different for an encrypted note and decrypted
                const encryptedPrefixSuffix = "ThisIsEncryptedContent&^$#$1%&8*)(^%$5#@";
                unencryptedContentForHashCalculation = Buffer.isBuffer(unencryptedContentForHashCalculation)
                    ? Buffer.concat([Buffer.from(encryptedPrefixSuffix), unencryptedContentForHashCalculation, Buffer.from(encryptedPrefixSuffix)])
                    : `${encryptedPrefixSuffix}${unencryptedContentForHashCalculation}${encryptedPrefixSuffix}`;
            }
            else {
                throw new Error(`Cannot update content of blob since we're out of protected session.`);
            }
        }

        sql.transactional(() => {
            let newBlobId = this._saveBlob(content, unencryptedContentForHashCalculation, opts);

            if (newBlobId !== this.blobId || opts.forceSave) {
                this.blobId = newBlobId;
                this.save();
            }
        });
    }

    /** @protected */
    _saveBlob(content, unencryptedContentForHashCalculation, opts = {}) {
        let newBlobId;
        let blobNeedsInsert;

        if (this._isHot() && !opts.forceCold) {
            newBlobId = this.blobId || utils.randomBlobId();
            blobNeedsInsert = true;
        } else {
            /*
             * We're using the unencrypted blob for the hash calculation, because otherwise the random IV would
             * cause every content blob to be unique which would balloon the database size (esp. with revisioning).
             * This has minor security implications (it's easy to infer that given content is shared between different
             * notes/attachments, but the trade-off comes out clearly positive).
             */
            newBlobId = utils.hashedBlobId(unencryptedContentForHashCalculation);
            blobNeedsInsert = !sql.getValue('SELECT 1 FROM blobs WHERE blobId = ?', [newBlobId]);
        }

        if (blobNeedsInsert) {
            const pojo = {
                blobId: newBlobId,
                content: content,
                dateModified: dateUtils.localNowDateTime(),
                utcDateModified: dateUtils.utcNowDateTime()
            };

            sql.upsert("blobs", "blobId", pojo);

            const hash = utils.hash(`${newBlobId}|${pojo.content.toString()}`);

            entityChangesService.addEntityChange({
                entityName: 'blobs',
                entityId: newBlobId,
                hash: hash,
                isErased: false,
                utcDateChanged: pojo.utcDateModified,
                isSynced: true,
                // overriding componentId will cause frontend to think the change is coming from a different component
                // and thus reload
                componentId: opts.forceFrontendReload ? utils.randomString(10) : null
            });

            eventService.emit(eventService.ENTITY_CHANGED, {
                entityName: 'blobs',
                entity: this
            });
        }

        return newBlobId;
    }

    /**
     * @protected
     * @returns {string|Buffer}
     */
    _getContent() {
        const row = sql.getRow(`SELECT content FROM blobs WHERE blobId = ?`, [this.blobId]);

        if (!row) {
            throw new Error(`Cannot find content for ${this.constructor.primaryKeyName} '${this[this.constructor.primaryKeyName]}', blobId '${this.blobId}'`);
        }

        let content = row.content;

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                content = content === null ? null : protectedSessionService.decrypt(content);
            } else {
                content = "";
            }
        }

        if (this.hasStringContent()) {
            return content === null
                ? ""
                : content.toString("utf-8");
        } else {
            return content;
        }
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

module.exports = AbstractBeccaEntity;
