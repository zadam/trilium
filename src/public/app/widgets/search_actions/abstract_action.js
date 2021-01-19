import server from "../../services/server.js";
import ws from "../../services/ws.js";

export default class AbstractAction {
    constructor(attribute, actionDef) {
        this.attribute = attribute;
        this.actionDef = actionDef;
    }

    render() {
        try {
            const $rendered = this.doRender();

            $rendered.attr('data-attribute-id', this.attribute.attributeId);

            return $rendered;
        }
        catch (e) {
            logError(`Failed rendering search action: ${JSON.stringify(this.attribute.dto)} with error: ${e.message} ${e.stack}`);
            return null;
        }
    }

    // to be overriden
    doRender() {}

    async saveAction(data) {
        const actionObject = Object.assign({ name: this.constructor.actionName }, data);

        await server.put(`notes/${this.attribute.noteId}/attribute`, {
            attributeId: this.attribute.attributeId,
            type: 'label',
            name: 'action',
            value: JSON.stringify(actionObject)
        });

        await ws.waitForMaxKnownEntityChangeId();
    }
}
