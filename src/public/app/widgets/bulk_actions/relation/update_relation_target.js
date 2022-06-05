import SpacedUpdate from "../../../services/spaced_update.js";
import AbstractBulkAction from "../abstract_bulk_action.js";
import noteAutocompleteService from "../../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px;" class="text-nowrap">Update relation</div> 
            
            <input type="text" 
                class="form-control relation-name" 
                placeholder="relation name"
                pattern="[\\p{L}\\p{N}_:]+"
                style="flex-shrink: 3"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
                
            <div style="margin-right: 10px; margin-left: 10px;" class="text-nowrap">to</div>
            
            <div class="input-group" style="flex-shrink: 2">
                <input type="text" class="form-control target-note" placeholder="target note"/>
            </div>
        </div>
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                <p>On all matched notes:</p>
                
                <ul>
                    <li>create given relation if note doesn't have one yet</li>
                    <li>or change target note of the existing relation</li>
                </ul>
            </div> 
        </div>
    
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class UpdateRelationTargetBulkAction extends AbstractBulkAction {
    static get actionName() { return "updateRelationTarget"; }
    static get actionTitle() { return "Update relation target"; }

    doRender() {
        const $action = $(TPL);

        const $relationName = $action.find('.relation-name');
        $relationName.val(this.actionDef.relationName || "");

        const $targetNote = $action.find('.target-note');
        noteAutocompleteService.initNoteAutocomplete($targetNote);
        $targetNote.setNote(this.actionDef.targetNoteId);

        $targetNote.on('autocomplete:closed', () => spacedUpdate.scheduleUpdate());

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({
                relationName: $relationName.val(),
                targetNoteId: $targetNote.getSelectedNoteId()
            });
        }, 1000)

        $relationName.on('input', () => spacedUpdate.scheduleUpdate());
        $targetNote.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
