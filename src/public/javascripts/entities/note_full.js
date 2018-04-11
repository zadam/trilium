import NoteShort from './note_short.js';

class NoteFull extends NoteShort {
    constructor(treeCache, row) {
        super(treeCache, row);

        this.content = row.content;

        if (this.content !== "" && this.isJson()) {
            try {
                this.jsonContent = JSON.parse(this.content);
            }
            catch(e) {}
        }
    }
}

export default NoteFull;