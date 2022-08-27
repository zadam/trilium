import AbstractBulkAction from "../abstract_bulk_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <span class="bx bx-trash"></span>
    
        Delete matched notes
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                <p>This will delete matched notes.</p>
                 
                <p>After the deletion, it's possible to undelete them from <span class="bx bx-history"></span> Recent Notes dialog.</p>
                
                <p>To erase notes permanently, you can go after the deletion to the Option -> Other and click the "Erase deleted notes now" button.</p>
            </div>
        </div>
        
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class DeleteNoteBulkAction extends AbstractBulkAction {
    static get actionName() { return "deleteNote"; }
    static get actionTitle() { return "Delete note"; }

    doRender() {
        return $(TPL);
    }
}
