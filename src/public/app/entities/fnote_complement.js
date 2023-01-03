/**
 * Complements the FNote with the main note content and other extra attributes
 */
class FNoteComplement {
    constructor(row) {
        /** @type {string} */
        this.noteId = row.noteId;

        /**
         * can either contain the whole content (in e.g. string notes), only part (large text notes) or nothing at all (binary notes, images)
         * @type {string}
         */
        this.content = row.content;

        /** @type {int} */
        this.contentLength = row.contentLength;

        /** @type {string} */
        this.dateCreated = row.dateCreated;

        /** @type {string} */
        this.dateModified = row.dateModified;

        /** @type {string} */
        this.utcDateCreated = row.utcDateCreated;

        /** @type {string} */
        this.utcDateModified = row.utcDateModified;

        // "combined" date modified give larger out of note's and note_content's dateModified

        /** @type {string} */
        this.combinedDateModified = row.combinedDateModified;

        /** @type {string} */
        this.combinedUtcDateModified = row.combinedUtcDateModified;
    }
}

export default FNoteComplement;
