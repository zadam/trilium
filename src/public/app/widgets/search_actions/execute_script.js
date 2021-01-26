import SpacedUpdate from "../../services/spaced_update.js";
import AbstractSearchAction from "./abstract_search_action.js";

const TPL = `
<tr>
    <td>
        Execute script:
    </td>
    <td>
        <div style="display: flex; align-items: center">
            <div style="margin-right: 15px;" class="text-nowrap">Script: </div> 
            
            <input type="text" 
               class="form-control script"
               placeholder="note.title = note.title + '- suffix';"/>
        </div>
    </td>
    <td>
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class ExecuteScriptSearchAction extends AbstractSearchAction {
    static get actionName() { return "executeScript"; }

    doRender() {
        const $action = $(TPL);
        const $script = $action.find('.script');
        $script.val(this.actionDef.script || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({ script: $script.val() });
        }, 1000)

        $script.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
