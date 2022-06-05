import AbstractBulkAction from "./abstract_bulk_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <span class="bx bx-trash"></span>
    
        Delete matched notes
    </td>
    <td class="button-column">
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
