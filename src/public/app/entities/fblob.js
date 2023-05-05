class FBlob {
    constructor(row) {
        /** @type {string} */
        this.blobId = row.blobId;

        /**
         * can either contain the whole content (in e.g. string notes), only part (large text notes) or nothing at all (binary notes, images)
         * @type {string}
         */
        this.content = row.content;

        /** @type {string} */
        this.dateModified = row.dateModified;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
    }
}