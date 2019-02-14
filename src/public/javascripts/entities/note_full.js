import NoteShort from './note_short.js';

/**
 * Represents full note, specifically including note's content.
 */
class NoteFull extends NoteShort {
    constructor(treeCache, row) {
        super(treeCache, row);

        /** @param {string} */
        this.noteContent = row.noteContent;

        /** @param {string} */
        this.dateCreated = row.dateCreated;

        /** @param {string} */
        this.dateModified = row.dateModified;
    }
}

export default NoteFull;