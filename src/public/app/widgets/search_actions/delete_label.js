import SpacedUpdate from "../../services/spaced_update.js";
import AbstractSearchAction from "./abstract_search_action.js";

const TPL = `
<tr>
    <td>
        Delete label:
    </td>
    <td>
        <input type="text" 
           class="form-control label-name"
           pattern="[\\p{L}\\p{N}_:]+"
           title="Alphanumeric characters, underscore and colon are allowed characters."
           placeholder="label name"/>
    </td>
    <td class="button-column">
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class DeleteLabelSearchAction extends AbstractSearchAction {
    static get actionName() { return "deleteLabel"; }

    doRender() {
        const $action = $(TPL);
        const $labelName = $action.find('.label-name');
        $labelName.val(this.actionDef.labelName || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({ labelName: $labelName.val() });
        }, 1000)

        $labelName.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
