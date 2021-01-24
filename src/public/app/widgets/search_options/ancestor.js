import AbstractSearchOption from "./abstract_search_option.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";

const TPL = `
<tr>
    <td>Search string:</td>
    <td>
        <input type="text" class="form-control search-string">
    </td>
    <td>
        <div class="dropdown">
          <button class="btn btn-secondary dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            ?
          </button>
          <div class="dropdown-menu dropdown-menu-right p-4" style="width: 500px;">
            <strong>Search tips</strong> - also see <button class="btn btn-sm" type="button" data-help-page="Search">complete help on search</button>
            <p>
            <ul>
                <li>Just enter any text for full text search</li>
                <li><code>#abc</code> - returns notes with label abc</li>
                <li><code>#year = 2019</code> - matches notes with label <code>year</code> having value <code>2019</code></li>
                <li><code>#rock #pop</code> - matches notes which have both <code>rock</code> and <code>pop</code> labels</li>
                <li><code>#rock or #pop</code> - only one of the labels must be present</li>
                <li><code>#year &lt;= 2000</code> - numerical comparison (also &gt;, &gt;=, &lt;).</li>
                <li><code>note.dateCreated >= MONTH-1</code> - notes created in the last month</li>
            </ul>
            </p>
        </div>
    </td>
</tr>`;

export default class Ancestor extends AbstractSearchOption {
    static get optionName() { return "ancestor" };
    static get attributeType() { return "relation" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId, 'relation', 'ancestor', 'root');
    }

    doRender() {
        const $option = $(TPL);
        const $ancestor = $option.find('.ancestor');
        noteAutocompleteService.initNoteAutocomplete($ancestor);

        $ancestor.on('autocomplete:closed', async () => {
            const ancestorOfNoteId = $ancestor.getSelectedNoteId();

            await this.setAttribute('relation', 'ancestor', ancestorOfNoteId);
        });

        const ancestorNoteId = this.note.getRelationValue('ancestor');

        $ancestor.setNote(ancestorNoteId);

        return $option;
    }
}
