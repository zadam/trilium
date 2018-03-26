import NoteShort from './note_short.js';

class NoteFull extends NoteShort {
    constructor(treeCache, row) {
        super(treeCache, row);

        this.content = row.content;

        if (this.isJson()) {
            this.jsonContent = JSON.parse(this.content);
        }
    }
}

export default NoteFull;