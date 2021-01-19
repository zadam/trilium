import SpacedUpdate from "../../services/spaced_update.js";
import AbstractAction from "./abstract_action.js";

const TPL = `
<tr>
    <td>
        Delete relation:
    </td>
    <td>
        <div style="display: flex; align-items: center">
            <div style="margin-right: 15px;" class="text-nowrap">Relation name:</div> 
            
            <input type="text" class="form-control relation-name"/>
        </div>
    </td>
    <td>
        <span class="bx bx-x icon-action" data-action-conf-del></span>
    </td>
</tr>`;

export default class DeleteRelationSearchAction extends AbstractAction {
    static get actionName() { return "deleteRelation"; }

    doRender() {
        const $action = $(TPL);
        const $relationName = $action.find('.relation-name');
        $relationName.val(this.actionDef.relationName || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({ relationName: $relationName.val() });
        }, 1000)

        $relationName.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
