import AbstractSearchOption from "./abstract_search_option.js";
import utils from "../../services/utils.js";
import SpacedUpdate from "../../services/spaced_update.js";
import server from "../../services/server.js";

const TPL = `
<tr>
    <td class="title-column">Search string:</td>
    <td>
        <textarea class="form-control search-string" placeholder="fulltext keywords, #tag = value ..."></textarea>
    </td>
    <td class="button-column">
        <div class="dropdown help-dropdown">
          <span class="bx bx-help-circle icon-action" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></span>
          <div class="dropdown-menu dropdown-menu-right p-4">
            <strong>Search syntax</strong> - also see <button class="btn btn-sm" type="button" data-help-page="Search">complete help on search syntax</button>
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
        </div>
        
        <span class="bx bx-x icon-action search-option-del"></span>
    </td>
</tr>`;

export default class SearchString extends AbstractSearchOption {
    static get optionName() { return "searchString" };
    static get attributeType() { return "label" };

    static async create(noteId) {
        await AbstractSearchOption.setAttribute(noteId, 'label', 'searchString');
    }

    doRender() {
        const $option = $(TPL);
        this.$searchString = $option.find('.search-string');
        this.$searchString.on('input', () => this.spacedUpdate.scheduleUpdate());

        utils.bindElShortcut(this.$searchString, 'return', async () => {
            // this also in effect disallows new lines in query string.
            // on one hand this makes sense since search string is a label
            // on the other hand it could be nice for structuring long search string. It's probably a niche case though.
            await this.spacedUpdate.updateNowIfNecessary();

            this.triggerCommand('refreshResults');
        });

        this.spacedUpdate = new SpacedUpdate(async () => {
            const searchString = this.$searchString.val();

            await this.setAttribute('label', 'searchString', searchString);

            if (this.note.title.startsWith('Search: ')) {
                await server.put(`notes/${this.note.noteId}/change-title`, {
                    title: 'Search: ' + (searchString.length < 30 ? searchString : `${searchString.substr(0, 30)}…`)
                });
            }
        }, 1000);

        this.$searchString.val(this.note.getLabelValue('searchString'));

        return $option;
    }

    focusOnSearchDefinitionEvent() {
        this.$searchString.focus();
    }
}
