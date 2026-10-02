"use strict";

import {
    type CollaborationCreateMode, type CollaborationEditMode, type CollaborationRow,
    type CollaborationViewMode, DEFAULT_COLLABORATION_MAX_GUESTS
} from "@triliumnext/commons";

import dateUtils from "../../services/utils/date";
import AbstractBeccaEntity from "./abstract_becca_entity.js";
import type BNote from "./bnote.js";

/**
 * A collaboration opens one note, or its whole subtree, to guests at `/collab/:collabId`.
 *
 * Each capability (view, edit, create child notes) is either open to anyone with the link or
 * gated by a password the host sets. Only the scrypt hash and salt of each password are stored,
 * and the row syncs like `etapi_tokens`, so every instance of the host's sync cluster can serve
 * the link.
 */
class BCollaboration extends AbstractBeccaEntity<BCollaboration> {

    static get entityName() {
        return "collaborations";
    }
    static get primaryKeyName() {
        return "collabId";
    }
    static get hashedProperties() {
        return [
            "collabId", "noteId", "includeSubtree", "viewMode", "editMode", "createMode",
            "viewPasswordHash", "viewPasswordSalt", "editPasswordHash", "editPasswordSalt",
            "createPasswordHash", "createPasswordSalt", "slug", "maxGuests", "hostName",
            "utcDateCreated", "utcDateModified", "isDeleted"
        ];
    }

    collabId?: string;
    noteId!: string;
    includeSubtree!: boolean;
    viewMode!: CollaborationViewMode;
    editMode!: CollaborationEditMode;
    createMode!: CollaborationCreateMode;
    viewPasswordHash!: string | null;
    viewPasswordSalt!: string | null;
    editPasswordHash!: string | null;
    editPasswordSalt!: string | null;
    createPasswordHash!: string | null;
    createPasswordSalt!: string | null;
    slug!: string | null;
    /** How many guests can be connected at the same time; the host's own sockets never count. */
    maxGuests!: number;
    /** The name the host goes by on the guest pages, or null for the default name. */
    hostName!: string | null;
    private _isDeleted?: boolean;

    constructor(row?: CollaborationRow) {
        super();

        if (!row) {
            return;
        }

        this.updateFromRow(row);
        this.init();
    }

    override get isDeleted() {
        return !!this._isDeleted;
    }

    updateFromRow(row: CollaborationRow) {
        this.collabId = row.collabId;
        this.noteId = row.noteId;
        this.includeSubtree = !!row.includeSubtree;
        this.viewMode = row.viewMode;
        this.editMode = row.editMode;
        this.createMode = row.createMode;
        this.viewPasswordHash = row.viewPasswordHash ?? null;
        this.viewPasswordSalt = row.viewPasswordSalt ?? null;
        this.editPasswordHash = row.editPasswordHash ?? null;
        this.editPasswordSalt = row.editPasswordSalt ?? null;
        this.createPasswordHash = row.createPasswordHash ?? null;
        this.createPasswordSalt = row.createPasswordSalt ?? null;
        this.slug = row.slug ?? null;
        this.maxGuests = row.maxGuests ?? DEFAULT_COLLABORATION_MAX_GUESTS;
        this.hostName = row.hostName ?? null;
        this.utcDateCreated = row.utcDateCreated || dateUtils.utcNowDateTime();
        this.utcDateModified = row.utcDateModified || this.utcDateCreated;
        this._isDeleted = !!row.isDeleted;

        if (this.collabId) {
            this.becca.collaborations[this.collabId] = this;
        }
    }

    override init() {
        if (this.collabId) {
            this.becca.collaborations[this.collabId] = this;
        }
    }

    /** Returns the note the collaboration opens, or null when that note is gone. */
    getNote(): BNote | null {
        return this.becca.getNote(this.noteId);
    }

    getPojo(): CollaborationRow {
        return {
            collabId: this.collabId,
            noteId: this.noteId,
            includeSubtree: this.includeSubtree,
            viewMode: this.viewMode,
            editMode: this.editMode,
            createMode: this.createMode,
            viewPasswordHash: this.viewPasswordHash,
            viewPasswordSalt: this.viewPasswordSalt,
            editPasswordHash: this.editPasswordHash,
            editPasswordSalt: this.editPasswordSalt,
            createPasswordHash: this.createPasswordHash,
            createPasswordSalt: this.createPasswordSalt,
            slug: this.slug,
            maxGuests: this.maxGuests,
            hostName: this.hostName,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified,
            isDeleted: this.isDeleted
        };
    }

    /** Flips the flag before the base method hashes the deletion, so a reload agrees. */
    override markAsDeletedSimple() {
        this._isDeleted = true;

        super.markAsDeletedSimple();
    }

    override beforeSaving() {
        this.utcDateModified = dateUtils.utcNowDateTime();

        super.beforeSaving();

        if (this.collabId) {
            this.becca.collaborations[this.collabId] = this;
        }
    }

}

export default BCollaboration;
