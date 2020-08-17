/**
 * Complements the NoteShort with the main note content and other extra attributes
 */
class NoteComplement {
    constructor(row) {
        /** @param {string} */
        this.noteId = row.noteId;

        /**
         * @param {string} - can either contain the whole content (in e.g. string notes), only part (large text notes) or nothing at all (binary notes, images)
         */
        this.content = row.content;

        /** @param {int} */
        this.contentLength = row.contentLength;

        /** @param {string} */
        this.dateCreated = row.dateCreated;

        /** @param {string} */
        this.dateModified = row.dateModified;

        /** @param {string} */
        this.utcDateCreated = row.utcDateCreated;

        /** @param {string} */
        this.utcDateModified = row.utcDateModified;

        // "combined" date modified give larger out of note's and note_content's dateModified

        /** @param {string} */
        this.combinedDateModified = row.combinedDateModified;

        /** @param {string} */
        this.combinedUtcDateModified = row.combinedUtcDateModified;
    }
}

export default NoteComplement;
