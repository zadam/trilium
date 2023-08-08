import AbstractSearchOption from "./abstract_search_option.js";

const TPL = `
<tr data-search-option-conf="fastSearch">
    <td colSpan="2">
        <span class="bx bx-run"></span>

        Fast search
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
            <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
            <div class="dropdown-menu dropdown-menu-right p-4">
                Fast search option disables full text search of note contents which might speed up searching in large databases.
            </div> 
        </div>
    
        <span class="bx bx-x icon-action search-option-del"></span>
    </td>
</tr>`;

export default class FastSearch extends AbstractSearchOption {
    static get optionName() { return "fastSearch" };
    static get attributeType() { return "label" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId,'label', 'fastSearch');
    }

    doRender() {
        return $(TPL);
    }
}
