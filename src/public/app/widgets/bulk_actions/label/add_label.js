import SpacedUpdate from "../../../services/spaced_update.js";
import AbstractBulkAction from "../abstract_bulk_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px;" class="text-nowrap">Add label</div> 
            
            <input type="text" 
                class="form-control label-name" 
                placeholder="label name"
                pattern="[\\p{L}\\p{N}_:]+"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
            
            <div style="margin-right: 10px; margin-left: 10px;" class="text-nowrap">to value</div>
            
            <input type="text" class="form-control label-value" placeholder="new value"/>
        </div>
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                <p>On all matched notes:</p>
                
                <ul>
                    <li>create given label if note doesn't have one yet</li>
                    <li>or change value of the existing label</li>
                </ul>
                
                <p>You can also call this method without value, in such case label will be assigned to the note without value.</p>
            </div> 
        </div>
    
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class AddLabelBulkAction extends AbstractBulkAction {
    static get actionName() { return "addLabel"; }
    static get actionTitle() { return "Add label"; }

    doRender() {
        const $action = $(TPL);

        const $labelName = $action.find('.label-name');
        $labelName.val(this.actionDef.labelName || "");

        const $labelValue = $action.find('.label-value');
        $labelValue.val(this.actionDef.labelValue || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({
                labelName: $labelName.val(),
                labelValue: $labelValue.val()
            });
        }, 1000);

        $labelName.on('input', () => spacedUpdate.scheduleUpdate());
        $labelValue.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
