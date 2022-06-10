import SpacedUpdate from "../../../services/spaced_update.js";
import AbstractBulkAction from "../abstract_bulk_action.js";
import noteAutocompleteService from "../../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px;" class="text-nowrap">Move note</div> 
                            
            <div style="margin-right: 10px;" class="text-nowrap">to</div>
            
            <div class="input-group">
                <input type="text" class="form-control target-parent-note" placeholder="target parent note"/>
            </div>
        </div>
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                <p>On all matched notes:</p>
                
                <ul>
                    <li>move note to the new parent if note has only one parent (i.e. the old placement is removed and new placement into the new parent is created)</li>
                    <li>clone note to the new parent if note has multiple clones/placements (it's not clear which placement should be removed)</li>
                    <li>nothing will happen if note cannot be moved to the target note (i.e. this would create a tree cycle)</li>
                </ul>
            </div> 
        </div>
    
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class MoveNoteBulkAction extends AbstractBulkAction {
    static get actionName() { return "moveNote"; }
    static get actionTitle() { return "Move note"; }

    doRender() {
        const $action = $(TPL);

        const $targetParentNote = $action.find('.target-parent-note');
        noteAutocompleteService.initNoteAutocomplete($targetParentNote);
        $targetParentNote.setNote(this.actionDef.targetParentNoteId);

        $targetParentNote.on('autocomplete:closed', () => spacedUpdate.scheduleUpdate());

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({
                targetParentNoteId: $targetParentNote.getSelectedNoteId()
            });
        }, 1000)

        $targetParentNote.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
