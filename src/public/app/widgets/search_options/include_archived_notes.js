import AbstractSearchOption from "./abstract_search_option.js";

const TPL = `
<tr data-search-option-conf="includeArchivedNotes">
    <td colspan="2">
        <span class="bx bx-archive"></span>
    
        Include archived notes
    </td>
    <td class="button-column">
        <span class="bx bx-x icon-action search-option-del"></span>
    </td>
</tr>`;

export default class IncludeArchivedNotes extends AbstractSearchOption {
    static get optionName() { return "includeArchivedNotes" };
    static get attributeType() { return "label" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId,'label', 'includeArchivedNotes');
    }

    doRender() {
        return $(TPL);
    }
}
