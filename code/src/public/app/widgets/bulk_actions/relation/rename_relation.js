import SpacedUpdate from "../../../services/spaced_update.js";
import AbstractBulkAction from "../abstract_bulk_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px; flex-shrink: 0;">Rename relation from:</div> 
            
            <input type="text" 
                class="form-control old-relation-name" 
                placeholder="old name" 
                pattern="[\\p{L}\\p{N}_:]+"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
            
            <div style="margin-right: 10px; margin-left: 10px;">To:</div> 
            
            <input type="text" 
                class="form-control new-relation-name" 
                placeholder="new name"
                pattern="[\\p{L}\\p{N}_:]+"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
        </div>
    </td>
    <td class="button-column">
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class RenameRelationBulkAction extends AbstractBulkAction {
    static get actionName() { return "renameRelation"; }
    static get actionTitle() { return "Rename relation"; }

    doRender() {
        const $action = $(TPL);

        const $oldRelationName = $action.find('.old-relation-name');
        $oldRelationName.val(this.actionDef.oldRelationName || "");

        const $newRelationName = $action.find('.new-relation-name');
        $newRelationName.val(this.actionDef.newRelationName || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({
                oldRelationName: $oldRelationName.val(),
                newRelationName: $newRelationName.val()
            });
        }, 1000)

        $oldRelationName.on('input', () => spacedUpdate.scheduleUpdate());
        $newRelationName.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
