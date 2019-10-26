import NoteShort from './note_short.js';

/**
 * Represents full note, specifically including note's content.
 */
class NoteFull extends NoteShort {
    constructor(treeCache, row, noteShort) {
        super(treeCache, row, []);

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

        /* ugly */
        this.parents = noteShort.parents;
        this.parentToBranch = noteShort.parentToBranch;
        this.children = noteShort.children;
        this.childToBranch = noteShort.childToBranch;
    }
}

export default NoteFull;