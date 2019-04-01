import NoteShort from './note_short.js';

/**
 * Represents full note, specifically including note's content.
 */
class NoteFull extends NoteShort {
    constructor(treeCache, row) {
        super(treeCache, row);

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

export default NoteFull;