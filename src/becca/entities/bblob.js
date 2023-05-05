class BBlob {
    constructor(row) {
        /** @type {string} */
        this.blobId = row.blobId;
        /** @type {string|Buffer} */
        this.content = row.content;
        /** @type {number} */
        this.contentLength = row.contentLength;
        /** @type {string} */
        this.dateModified = row.dateModified;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
    }

    getPojo() {
        return {
            blobId: this.blobId,
            content: this.content,
            contentLength: this.contentLength,
            dateModified: this.dateModified,
            utcDateModified: this.utcDateModified
        };
    }
}

module.exports = BBlob;