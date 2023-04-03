class FAttachment {
    constructor(froca, row) {
        this.froca = froca;

        this.update(row);
    }

    update(row) {
        /** @type {string} */
        this.attachmentId = row.attachmentId;
        /** @type {string} */
        this.parentId = row.parentId;
        /** @type {string} */
        this.role = row.role;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {string} */
        this.title = row.title;
        /** @type {string} */
        this.dateModified = row.dateModified;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
        /** @type {string} */
        this.utcDateScheduledForDeletionSince = row.utcDateScheduledForDeletionSince;

        this.froca.attachments[this.attachmentId] = this;
    }

    /** @returns {FNote} */
    getNote() {
        return this.froca.notes[this.parentId];
    }
}
