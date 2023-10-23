/**
 * Attachment is a file directly tied into a note without
 * being a hidden child.
 */
class FAttachment {
    constructor(froca, row) {
        /** @type {Froca} */
        this.froca = froca;

        this.update(row);
    }

    update(row) {
        /** @type {string} */
        this.attachmentId = row.attachmentId;
        /** @type {string} */
        this.ownerId = row.ownerId;
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
        this.utcDateScheduledForErasureSince = row.utcDateScheduledForErasureSince;

        /**
         * optionally added to the entity 
         * @type {int}
         */
        this.contentLength = row.contentLength;

        this.froca.attachments[this.attachmentId] = this;
    }

    /** @returns {FNote} */
    getNote() {
        return this.froca.notes[this.ownerId];
    }

    /** @return {FBlob} */
    async getBlob() {
        return await this.froca.getBlob('attachments', this.attachmentId);
    }
}

export default FAttachment;
