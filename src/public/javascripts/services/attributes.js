import server from "./server.js";
import ws from "./ws.js";
import treeUtils from "./tree_utils.js";
import noteAutocompleteService from "./note_autocomplete.js";

class Attributes {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.attributePromise = null;
    }

    invalidateAttributes() {
        this.attributePromise = null;
    }

    reloadAttributes() {
        this.attributePromise = server.get(`notes/${this.ctx.note.noteId}/attributes`);
    }

    async refreshAttributes() {
        this.reloadAttributes();
    }

    async getAttributes() {
        if (!this.attributePromise) {
            this.reloadAttributes();
        }

        return this.attributePromise;
    }

    eventReceived(name, data) {
        if (!this.ctx.note) {
            return;
        }

        if (name === 'syncData') {
            if (data.find(sd => sd.entityName === 'attributes' && sd.noteId === this.ctx.note.noteId)) {
                this.reloadAttributes();
            }
        }
    }
}

export default Attributes;