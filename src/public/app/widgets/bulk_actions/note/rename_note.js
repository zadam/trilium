import SpacedUpdate from "../../../services/spaced_update.js";
import AbstractBulkAction from "../abstract_bulk_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <div style="display: flex; align-items: center">
            <div style="margin-right: 10px; flex-shrink: 0;">Rename note title to:</div> 
            
            <input type="text" 
                class="form-control new-title" 
                placeholder="new note title" 
                title="Click help icon on the right to see all the options"/>
        </div>
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                <p>The given value is evaluated as JavaScript string and thus can be enriched with dynamic content via the injected <code>note</code> variable (note being renamed). Examples:</p>
                
                <ul>
                    <li><code>Note</code> - all matched notes are renamed to "Note"</li>
                    <li><code>NEW: \${note.title}</code> - matched notes titles are prefixed with "NEW: "</li>
                    <li><code>\${note.dateCreatedObj.format('MM-DD:')}: \${note.title}</code> - matched notes are prefixed with note's creation month-date</li>
                </ul>
                
                See API docs for <a href="https://zadam.github.io/trilium/backend_api/Note.html">note</a> and its <a href="https://day.js.org/docs/en/display/format">dateCreatedObj / utcDateCreatedObj properties</a> for details.
            </div>
        </div>
    
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class RenameNoteBulkAction extends AbstractBulkAction {
    static get actionName() { return "renameNote"; }
    static get actionTitle() { return "Rename note"; }

    doRender() {
        const $action = $(TPL);

        const $newTitle = $action.find('.new-title');
        $newTitle.val(this.actionDef.newTitle || "");

        const spacedUpdate = new SpacedUpdate(async () => {
            await this.saveAction({
                newTitle: $newTitle.val(),
            });
        }, 1000);

        $newTitle.on('input', () => spacedUpdate.scheduleUpdate());

        return $action;
    }
}
