import AbstractSearchOption from "./abstract_search_option.js";

const TPL = `
<tr data-search-option-conf="orderBy">
    <td>
        <span class="bx bx-arrow-from-top"></span>
    
        Order by
    </td>
    <td>
        <select name="orderBy" class="form-control w-auto d-inline">
            <option value="relevancy">Relevancy (default)</option>
            <option value="title">Title</option>
            <option value="dateCreated">Date created</option>
            <option value="dateModified">Date of last modification</option>
            <option value="contentSize">Note content size</option>
            <option value="noteSize">Note content size including revisions</option>
            <option value="revisionCount">Number of revisions</option>
        </select>
        
        <select name="orderDirection" class="form-control w-auto d-inline">
            <option value="asc">Ascending (default)</option>
            <option value="desc">Descending</option>
        </select>
    </td>
    <td>
        <span class="bx bx-x icon-action" data-search-option-del="orderBy"></span>
    </td>
</tr>`;

export default class OrderBy extends AbstractSearchOption {
    static get optionName() { return "orderBy" };
    static get attributeType() { return "label" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId, 'label', 'orderBy', 'relevancy');
        await AbstractSearchOption.setAttribute(noteId, 'label', 'orderDirection', 'asc');
    }

    doRender() {
        const $option = $(TPL);

        const $orderBy = $option.find('select[name=orderBy]');
        $orderBy.on('change', async () => {
            const orderBy = $orderBy.val();

            await this.setAttribute('label', 'orderBy', orderBy);
        });
        $orderBy.val(this.note.getLabelValue('orderBy'));

        const $orderDirection = $option.find('select[name=orderDirection]');
        $orderDirection.on('change', async () => {
            const orderDirection = $orderDirection.val();

            await this.setAttribute('label', 'orderDirection', orderDirection);
        });
        $orderDirection.val(this.note.getLabelValue('orderDirection') || 'asc');

        return $option;
    }
}
