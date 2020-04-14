/**
 * Complements the NoteShort with the main note content and other extra attributes
 */
class NoteComplement {
    constructor(row) {
        /** @param {string} */
        this.noteId = row.noteId;

        /** @param {string} */
        this.content = row.content;

        /** @param {string} */
        this.dateCreated = row.dateCreated;

        /** @param {string} */
        this.dateModified = row.dateModified;

        /** @param {string} */
        this.utcDateCreated = row.utcDateCreated;

        /** @param {string} */
        this.utcDateModified = row.utcDateModified;
    }
}

export default NoteComplement;