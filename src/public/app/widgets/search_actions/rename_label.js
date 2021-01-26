import SpacedUpdate from "../../services/spaced_update.js";
import AbstractSearchAction from "./abstract_search_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px;">Rename label from:</div> 
            
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

export default class RenameLabelSearchAction extends AbstractSearchAction {
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
