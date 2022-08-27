import SpacedUpdate from "../../services/spaced_update.js";
import AbstractBulkAction from "./abstract_bulk_action.js";

const TPL = `
<tr>
    <td>
        Execute script:
    </td>
    <td>
        <input type="text" 
           class="form-control script"
           placeholder="note.title = note.title + '- suffix';"/>
    </td>
    <td class="button-column">
        <div style="display: flex">
            <div class="dropdown help-dropdown">
              <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
              <div class="dropdown-menu dropdown-menu-right p-4">
                You can execute simple scripts on the matched notes.
                
                For example to append a string to a note's title, use this small script:
                
                <pre>note.title = note.title + ' - suffix';</pre>
                
                More complex example would be deleting all matched note's attributes:
                
                <pre>for (const attr of note.getOwnedAttributes) { attr.markAsDeleted(); }</pre>
              </div>
            </div>
        
            <span class="bx bx-x icon-action action-conf-del"></span>
        </div>
    </td>
</tr>`;

export default class ExecuteScriptBulkAction extends AbstractBulkAction {
    static get actionName() { return "executeScript"; }
    static get actionTitle() { return "Execute script"; }

    doRender() {
        const $action = $(TPL);
        const $script = $action.find('.script');
        $script.val(this.actionDef.script || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({ script: $script.val() });
        }, 1000);

        $script.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
