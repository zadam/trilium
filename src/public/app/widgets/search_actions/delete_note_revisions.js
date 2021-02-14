import AbstractSearchAction from "./abstract_search_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <span class="bx bx-trash"></span>
    
        Delete note revisions
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                All past note revisions of matched notes will be deleted. Note itself will be fully preserved. In other terms, note's history will be removed.
            </div>
        </div>
    
        <span class="bx bx-x icon-action action-conf-del"></span>
    </td>
</tr>`;

export default class DeleteNoteRevisionsSearchAction extends AbstractSearchAction {
    static get actionName() { return "deleteNoteRevisions"; }

    doRender() {
        return $(TPL);
    }
}
