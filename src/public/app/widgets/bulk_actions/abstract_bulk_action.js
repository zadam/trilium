import server from "../../services/server.js";
import ws from "../../services/ws.js";
import utils from "../../services/utils.js";

export default class AbstractBulkAction {
    constructor(attribute, actionDef) {
        this.attribute = attribute;
        this.actionDef = actionDef;
    }

    render() {
        try {
            const $rendered = this.doRender();

            $rendered.find('.action-conf-del')
                .on('click', () => this.deleteAction())
                .attr('title', 'Remove this search action');

            utils.initHelpDropdown($rendered);

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

    async deleteAction() {
        await server.remove(`notes/${this.attribute.noteId}/attributes/${this.attribute.attributeId}`);

        await ws.waitForMaxKnownEntityChangeId();

        //await this.triggerCommand('refreshSearchDefinition');
    }
}
