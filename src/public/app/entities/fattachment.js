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
        this.utcDateScheduledForErasureSince = row.utcDateScheduledForErasureSince;

        this.froca.attachments[this.attachmentId] = this;
    }

    /** @returns {FNote} */
    getNote() {
        return this.froca.notes[this.parentId];
    }

    /**
     * @param [opts.preview=false] - retrieve only first 10 000 characters for a preview
     * @return {FBlob}
     */
    async getBlob(opts = {}) {
        return await this.froca.getBlob('attachments', this.attachmentId, opts);
    }
}

export default FAttachment;
