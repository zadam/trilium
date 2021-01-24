import server from "../../services/server.js";
import ws from "../../services/ws.js";

export default class AbstractSearchOption {
    constructor(attribute, note) {
        this.attribute = attribute;
        this.note = note;
    }

    static async setAttribute(noteId, type, name, value = '') {
        await server.put(`notes/${noteId}/set-attribute`, { type, name, value });

        await ws.waitForMaxKnownEntityChangeId();
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
