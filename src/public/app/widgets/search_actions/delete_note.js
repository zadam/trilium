import AbstractAction from "./abstract_action.js";

const TPL = `
<tr>
    <td colspan="2">
        <span class="bx bx-trash"></span>
    
        Delete matched note
    </td>
    <td>
        <span class="bx bx-x icon-action" data-action-conf-del></span>
    </td>
</tr>`;

export default class DeleteNoteSearchAction extends AbstractAction {
    static get actionName() { return "deleteNote"; }

    doRender() {
        return $(TPL);
    }
}
