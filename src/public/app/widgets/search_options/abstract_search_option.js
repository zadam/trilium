import server from "../../services/server.js";
import ws from "../../services/ws.js";
import Component from "../component.js";

export default class AbstractSearchOption extends Component {
    constructor(attribute, note) {
        super();

        this.attribute = attribute;
        this.note = note;
    }

    static async setAttribute(noteId, type, name, value = '') {
        await server.put(`notes/${noteId}/set-attribute`, { type, name, value });

        await ws.waitForMaxKnownEntityChangeId();
    }

    async setAttribute(type, name, value = '') {
        await this.constructor.setAttribute(this.note.noteId, type, name, value);
    }

    render() {
        try {
            const $rendered = this.doRender();

            $rendered.attr('data-attribute-id', this.attribute.attributeId);

            return $rendered;
        }
        catch (e) {
            logError(`Failed rendering search option: ${JSON.stringify(this.attribute.dto)} with error: ${e.message} ${e.stack}`);
            return null;
        }
    }

    // to be overriden
    doRender() {}
}
