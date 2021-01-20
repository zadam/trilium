import SpacedUpdate from "../../services/spaced_update.js";
import AbstractAction from "./abstract_action.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td>
        Set relation target note:
    </td>
    <td>        
        <div style="display: flex; align-items: center">
            <div style="margin-right: 15px;" class="text-nowrap">Set relation</div> 
            
            <input type="text" 
                class="form-control relation-name" 
                placeholder="relation name"
                pattern="[\\p{L}\\p{N}_:]+"
                title="Alphanumeric characters, underscore and colon are allowed characters."/>
        </div>
        <div style="display: flex; align-items: center; margin-top: 10px;">
            <div style="margin-right: 15px;" class="text-nowrap">target to note</div>
            
            <input type="text" class="form-control target-note"/>
        </div>
    </td>
    <td>
        <span class="bx bx-x icon-action" data-action-conf-del></span>
    </td>
</tr>`;

export default class SetRelationTargetSearchAction extends AbstractAction {
    static get actionName() { return "setRelationTarget"; }

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
