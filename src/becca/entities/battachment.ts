"use strict";

import utils = require('../../services/utils');
import dateUtils = require('../../services/date_utils');
import AbstractBeccaEntity = require('./abstract_becca_entity');
import sql = require('../../services/sql');
import protectedSessionService = require('../../services/protected_session');
import log = require('../../services/log');
import { AttachmentRow } from './rows';
import BNote = require('./bnote');
import BBranch = require('./bbranch');

const attachmentRoleToNoteTypeMapping = {
    'image': 'image',
    'file': 'file'
};

interface ContentOpts {
    // TODO: Found in bnote.ts, to check if it's actually used and not a typo.
    forceSave?: boolean;

    /** will also save this BAttachment entity */
    forceFullSave?: boolean;
    /** override frontend heuristics on when to reload, instruct to reload */
    forceFrontendReload?: boolean;
}

/**
 * Attachment represent data related/attached to the note. Conceptually similar to attributes, but intended for
 * larger amounts of data and generally not accessible to the user.
 */
class BAttachment extends AbstractBeccaEntity<BAttachment> {
    static get entityName() { return "attachments"; }
    static get primaryKeyName() { return "attachmentId"; }
    static get hashedProperties() { return ["attachmentId", "ownerId", "role", "mime", "title", "blobId", "utcDateScheduledForErasureSince"]; }

    noteId?: number;
    attachmentId?: string;
    /** either noteId or revisionId to which this attachment belongs */
    ownerId!: string;
    role!: string;
    mime!: string;
    title!: string;
    type?: keyof typeof attachmentRoleToNoteTypeMapping;
    position?: number;
    blobId?: string;
    isProtected?: boolean;
    dateModified?: string;
    utcDateScheduledForErasureSince?: string | null;
    /** optionally added to the entity */
    contentLength?: number;
    isDecrypted?: boolean;

    constructor(row: AttachmentRow) {
        super();

        this.updateFromRow(row);
        this.decrypt();
    }

    updateFromRow(row: AttachmentRow): void {
        if (!row.ownerId?.trim()) {
            throw new Error("'ownerId' must be given to initialize a Attachment entity");
        } else if (!row.role?.trim()) {
            throw new Error("'role' must be given to initialize a Attachment entity");
        } else if (!row.mime?.trim()) {
            throw new Error("'mime' must be given to initialize a Attachment entity");
        } else if (!row.title?.trim()) {
            throw new Error("'title' must be given to initialize a Attachment entity");
        }

        this.attachmentId = row.attachmentId;
        this.ownerId = row.ownerId;
        this.role = row.role;
        this.mime = row.mime;
        this.title = row.title;
        this.position = row.position;
        this.blobId = row.blobId;
        this.isProtected = !!row.isProtected;
        this.dateModified = row.dateModified;
        this.utcDateModified = row.utcDateModified;
        this.utcDateScheduledForErasureSince = row.utcDateScheduledForErasureSince;
        this.contentLength = row.contentLength;
    }

    copy(): BAttachment {
        return new BAttachment({
            ownerId: this.ownerId,
            role: this.role,
            mime: this.mime,
            title: this.title,
            blobId: this.blobId,
            isProtected: this.isProtected
        });
    }

    getNote(): BNote {
        return this.becca.notes[this.ownerId];
    }

    /** @returns true if the note has string content (not binary) */
    hasStringContent(): boolean {
        return this.type !== undefined && utils.isStringNote(this.type, this.mime);
    }

    isContentAvailable() {
        return !this.attachmentId // new attachment which was not encrypted yet
            || !this.isProtected
            || protectedSessionService.isProtectedSessionAvailable()
    }

    getTitleOrProtected() {
        return this.isContentAvailable() ? this.title : '[protected]';
    }

    decrypt() {
        if (!this.isProtected || !this.attachmentId) {
            this.isDecrypted = true;
            return;
        }

        if (!this.isDecrypted && protectedSessionService.isProtectedSessionAvailable()) {
            try {
                this.title = protectedSessionService.decryptString(this.title) || "";
                this.isDecrypted = true;
            }
            catch (e: any) {
                log.error(`Could not decrypt attachment ${this.attachmentId}: ${e.message} ${e.stack}`);
            }
        }
    }

    getContent(): Buffer {
        return this._getContent() as Buffer;
    }

    setContent(content: string | Buffer, opts?: ContentOpts) {
        this._setContent(content, opts);
    }

    convertToNote(): { note: BNote, branch: BBranch } {
        // TODO: can this ever be "search"?
        if (this.type as string === 'search') {
            throw new Error(`Note of type search cannot have child notes`);
        }

        if (!this.getNote()) {
            throw new Error("Cannot find note of this attachment. It is possible that this is note revision's attachment. " +
                "Converting note revision's attachments to note is not (yet) supported.");
        }

        if (!(this.role in attachmentRoleToNoteTypeMapping)) {
            throw new Error(`Mapping from attachment role '${this.role}' to note's type is not defined`);
        }

        if (!this.isContentAvailable()) { // isProtected is the same for attachment
            throw new Error(`Cannot convert protected attachment outside of protected session`);
        }

        const noteService = require('../../services/notes');

        const { note, branch } = noteService.createNewNote({
            parentNoteId: this.ownerId,
            title: this.title,
            type: (attachmentRoleToNoteTypeMapping as any)[this.role],
            mime: this.mime,
            content: this.getContent(),
            isProtected: this.isProtected
        });

        this.markAsDeleted();

        const parentNote = this.getNote();

        if (this.role === 'image' && parentNote.type === 'text') {
            const origContent = parentNote.getContent();
            
            if (typeof origContent !== "string") {
                throw new Error(`Note with ID '${note.noteId} has a text type but non-string content.`);
            }

            const oldAttachmentUrl = `api/attachments/${this.attachmentId}/image/`;
            const newNoteUrl = `api/images/${note.noteId}/`;

            const fixedContent = utils.replaceAll(origContent, oldAttachmentUrl, newNoteUrl);

            if (fixedContent !== origContent) {
                parentNote.setContent(fixedContent);
            }

            noteService.asyncPostProcessContent(note, fixedContent);
        }

        return { note, branch };
    }

    getFileName() {
        const type = this.role === 'image' ? 'image' : 'file';

        return utils.formatDownloadTitle(this.title, type, this.mime);
    }

    beforeSaving() {
        super.beforeSaving();

        if (this.position === undefined || this.position === null) {
            this.position = 10 + sql.getValue<number>(`SELECT COALESCE(MAX(position), 0)
                                                       FROM attachments
                                                       WHERE ownerId = ?`, [this.noteId]);
        }

        this.dateModified = dateUtils.localNowDateTime();
        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            attachmentId: this.attachmentId,
            ownerId: this.ownerId,
            role: this.role,
            mime: this.mime,
            title: this.title || undefined,
            position: this.position,
            blobId: this.blobId,
            isProtected: !!this.isProtected,
            isDeleted: false,
            dateModified: this.dateModified,
            utcDateModified: this.utcDateModified,
            utcDateScheduledForErasureSince: this.utcDateScheduledForErasureSince,
            contentLength: this.contentLength
        };
    }

    getPojoToSave() {
        const pojo = this.getPojo();
        delete pojo.contentLength;

        if (pojo.isProtected) {
            if (this.isDecrypted) {
                pojo.title = protectedSessionService.encrypt(pojo.title || "") || undefined;
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertexts
                delete pojo.title;
            }
        }

        return pojo;
    }
}

export = BAttachment;
