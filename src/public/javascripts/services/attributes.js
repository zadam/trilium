import server from "./server.js";
import ws from "./ws.js";
import treeService from "./tree.js";
import noteAutocompleteService from "./note_autocomplete.js";
import Component from "../widgets/component.js";
import utils from "./utils.js";

class Attributes extends Component {
    /**
     * @param {AppContext} appContext
     * @param {TabContext} tabContext
     */
    constructor(appContext, tabContext) {
        super(appContext);
        this.tabContext = tabContext;
        this.attributePromise = null;
    }

    invalidateAttributes() {
        this.attributePromise = null;
    }

    reloadAttributes() {
        if (this.tabContext.note) {
            this.attributePromise = server.get(`notes/${this.tabContext.note.noteId}/attributes`);
        }
        else {
            this.invalidateAttributes();
        }
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

    syncDataListener({data}) {
        if (this.tabContext.note && data.find(sd => sd.entityName === 'attributes' && sd.noteId === this.tabContext.note.noteId)) {
            this.reloadAttributes();
        }
    }

    tabNoteSwitchedListener() {
        if (utils.isDesktop()) {
            this.refreshAttributes();
        } else {
            // mobile usually doesn't need attributes so we just invalidate
            this.invalidateAttributes();
        }
    }
}

export default Attributes;