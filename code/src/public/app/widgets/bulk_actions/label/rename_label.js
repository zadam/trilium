import SpacedUpdate from "../../../services/spaced_update.js";
import AbstractBulkAction from "../abstract_bulk_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px; flex-shrink: 0;">Rename label from:</div> 
            
            <input type="text" 
                class="form-control old-label-name" 
                placeholder="old name" 
                pattern="[\\p{L}\\p{N}_:]+"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
            
            <div style="margin-right: 10px; margin-left: 10px;">To:</div> 
            
            <input type="text" 
                class="form-control new-label-name" 
                placeholder="new name"
                pattern="[\\p{L}\\p{N}_:]+"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
        </div>
    </td>
    <td class="button-column">
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class RenameLabelBulkAction extends AbstractBulkAction {
    static get actionName() { return "renameLabel"; }
    static get actionTitle() { return "Rename label"; }

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
        }, 1000);

        $oldLabelName.on('input', () => spacedUpdate.scheduleUpdate());
        $newLabelName.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
