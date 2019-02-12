import NoteShort from './note_short.js';

/**
 * Represents full note, specifically including note's content.
 */
class NoteFull extends NoteShort {
    constructor(treeCache, row) {
        super(treeCache, row);

        /** @param {string} */
        this.noteContent = row.noteContent;

        // if (this.content !== "" && this.isJson()) {
        //     try {
        //         /** @param {object} */
        //         this.jsonContent = JSON.parse(this.content);
        //     }
        //     catch(e) {}
        // }
    }
}

export default NoteFull;