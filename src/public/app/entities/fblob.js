export default class FBlob {
    constructor(row) {
        /** @type {string} */
        this.blobId = row.blobId;

        /**
         * can either contain the whole content (in e.g. string notes), only part (large text notes) or nothing at all (binary notes, images)
         * @type {string}
         */
        this.content = row.content;
        this.contentLength = row.contentLength;

        /** @type {string} */
        this.dateModified = row.dateModified;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
    }

    /**
     * @returns {*}
     * @throws Error in case of invalid JSON */
    getJsonContent() {
        if (!this.content || !this.content.trim()) {
            return null;
        }

        return JSON.parse(this.content);
    }

    /** @returns {*|null} valid object or null if the content cannot be parsed as JSON */
    getJsonContentSafely() {
        try {
            return this.getJsonContent();
        }
        catch (e) {
            return null;
        }
    }
}
