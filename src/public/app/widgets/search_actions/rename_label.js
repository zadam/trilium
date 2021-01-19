import SpacedUpdate from "../../services/spaced_update.js";
import AbstractAction from "./abstract_action.js";

const TPL = `
<tr>
    <td>
        Rename label:
    </td>
    <td>
        <div style="display: flex; align-items: center">
            <div style="display: flex; align-items: center">
                <div style="margin-right: 15px;">From:</div> 
                
                <input type="text" class="form-control old-label-name" placeholder="old name"/>
                
                <div style="margin-right: 15px; margin-left: 15px;">To:</div> 
                
                <input type="text" class="form-control new-label-name" placeholder="new name"/>
            </div>
        </div>
    </td>
    <td>
        <span class="bx bx-x icon-action" data-action-conf-del></span>
    </td>
</tr>`;

export default class RenameLabelSearchAction extends AbstractAction {
    static get actionName() { return "renameLabel"; }

    doRender() {
        const $action = $(TPL);

        const $oldLabelName = $action.find('.old-label-name');
        $oldLabelName.val(this.actionDef.oldLabelName || "");

        const $newLabelName = $action.find('.new-label-name');
        $newLabelName.val(this.actionDef.newLabelName || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({
                oldLabelName: $oldLabelName.val(),
                newLabelName: $newLabelName.val()
            });
        }, 1000)

        $oldLabelName.on('input', () => spacedUpdate.scheduleUpdate());
        $newLabelName.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
