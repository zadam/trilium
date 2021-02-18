import AbstractSearchOption from "./abstract_search_option.js";

const TPL = `
<tr data-search-option-conf="debug">
    <td colSpan="2">
        <span class="bx bx-bug"></span>

        Debug
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                <p>Debug will print extra debugging information into the console to aid in debugging complex queries.</p>
                
                <p>To access the debug information, execute query and click on "Show backend log" in top left corner.</p> 
            </div>
        </div>
    
        <span class="bx bx-x icon-action search-option-del"></span>
    </td>
</tr>`;

export default class Debug extends AbstractSearchOption {
    static get optionName() { return "debug" };
    static get attributeType() { return "label" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId,'label', 'debug');
    }

    doRender() {
        return $(TPL);
    }
}
