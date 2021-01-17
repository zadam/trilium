import noteAutocompleteService from "../services/note_autocomplete.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import TabAwareWidget from "./tab_aware_widget.js";
import treeCache from "../services/tree_cache.js";
import ws from "../services/ws.js";

const TPL = `
<div class="search-definition-widget">
    <style>
    .note-detail-search {
        padding: 7px;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    
    .search-setting-table {
        margin-top: 7px;
        margin-bottom: 7px;
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px;
    }
    
    .attribute-list hr {
        height: 1px;
        border-color: var(--main-border-color);
        position: relative;
        top: 4px;
        margin-top: 5px;
        margin-bottom: 0;
    }
    </style>

    <div class="search-settings">
        <table class="search-setting-table">
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
            </tr>
            <tr>
                <td>Add search option:</td>
                <td colspan="2" class="add-search-option">
                    <button type="button" class="btn btn-sm" data-search-option-add="descendantOf">
                        <span class="bx bx-filter-alt"></span> 
                        descendant of
                    </button>
                    
                    <button type="button" class="btn btn-sm" data-search-option-add="fastSearch"
                        title="Fast search option disables full text search of note contents which might speed up searching in large databases.">
                        <span class="bx bx-run"></span>
                        fast search
                    </button>
                    
                    <button type="button" class="btn btn-sm" data-search-option-add="includeArchivedNotes"
                        title="Archived notes are by default excluded from search results, with this option they will be included.">
                        <span class="bx bx-archive"></span>
                        include archived
                    </button>
                    
                    <button type="button" class="btn btn-sm" data-search-option-add="orderBy">
                        <span class="bx bx-arrow-from-top"></span>
                        order by
                    </button>
                    
                    <div class="dropdown" style="display: inline-block;">
                      <button class="btn btn-sm dropdown-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <span class="bx bxs-zap"></span>
                        action
                      </button>
                      <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                        <a class="dropdown-item" href="#">Delete note</a>
                        <a class="dropdown-item" href="#">Delete attribute</a>
                        <a class="dropdown-item" href="#">Rename attribute</a>
                        <a class="dropdown-item" href="#">Change label value</a>
                        <a class="dropdown-item" href="#">Change relation target</a>
                        <a class="dropdown-item" href="#">Execute script</a>
                      </div>
                    </div>
                </td>
            </tr>
            <tbody class="search-options">
                <tr data-search-option-conf="descendantOf">
                    <td title="Matched notes must be within subtree of given note.">
                        Descendant of: </td>
                    <td>
                        <div class="input-group">
                            <input class="descendant-of form-control" placeholder="search for note by its name">
                        </div>
                    </td>
                    <td>
                        <span class="bx bx-x icon-action" data-search-option-del="descendantOf"></span>
                    </td>
                </tr>
                <tr data-search-option-conf="fastSearch">
                    <td colspan="2">
                        <span class="bx bx-run"></span>
                    
                        Fast search
                    </td>
                    <td>
                        <span class="bx bx-x icon-action" data-search-option-del="fastSearch"></span>
                    </td>
                </tr>
                <tr data-search-option-conf="includeArchivedNotes">
                    <td colspan="2">
                        <span class="bx bx-archive"></span>
                    
                        Include archived notes
                    </td>
                    <td>
                        <span class="bx bx-x icon-action" data-search-option-del="includeArchivedNotes"></span>
                    </td>
                </tr>
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
                        </select>
                        
                        <select name="orderDirection" class="form-control w-auto d-inline">
                            <option value="asc">Ascending (default)</option>
                            <option value="desc">Descending</option>
                        </select>
                    </td>
                    <td>
                        <span class="bx bx-x icon-action" data-search-option-del="orderBy"></span>
                    </td>
                </tr>
            </tbody>
            <tr>
                <td colspan="2">
                    <span class="bx bx-trash"></span>
                
                    Delete matched note
                </td>
                <td>
                    <span class="bx bx-x icon-action"></span>
                </td>
            </tr>
            <tr>
                <td>
                    Rename attribute name:
                </td>
                <td>
                    <div style="display: flex; align-items: center">
                        <div style="margin-right: 15px;">From:</div> 
                        
                        <input type="text" class="form-control" placeholder="old name"/>
                        
                        <div style="margin-right: 15px; margin-left: 15px;">To:</div> 
                        
                        <input type="text" class="form-control" placeholder="new name"/>
                    </div>
                </td>
                <td>
                    <span class="bx bx-x icon-action"></span>
                </td>
            </tr>
            <tr>
                <td colspan="3">
                    <div style="display: flex; justify-content: space-evenly">
                        <button type="button" class="btn btn-sm">
                            <span class="bx bx-search"></span>
                            Search
                            
                            <kbd>enter</kbd>
                        </button>
    
                        <button type="button" class="btn btn-sm">
                            <span class="bx bxs-zap"></span>
                            Search & Execute actions
                        </button>
                    </div>
                </td>
            </tr>
        </table>
    </div>
</div>`;

export default class SearchDefinitionWidget extends TabAwareWidget {
    static getType() { return "search"; }

    renderTitle(note) {
        return {
            show: note.type === 'search',
            activate: true,
            $title: 'Search'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.$component = this.$widget.find('.search-definition-widget');

        this.contentSized();
        this.overflowing();

        this.$searchString = this.$widget.find(".search-string");
        this.$searchString.on('input', () => this.searchStringSU.scheduleUpdate());

        this.searchStringSU = new SpacedUpdate(async () => {
            const searchString = this.$searchString.val();

            await this.setAttribute('label', 'searchString', searchString);

            if (this.note.title.startsWith('Search: ')) {
                await server.put(`notes/${this.noteId}/change-title`, {
                    title: 'Search: ' + (searchString.length < 30 ? searchString : `${searchString.substr(0, 30)}…`)
                });
            }
        }, 1000);

        this.$descendantOf = this.$widget.find('.descendant-of');
        noteAutocompleteService.initNoteAutocomplete(this.$descendantOf);

        this.$descendantOf.on('autocomplete:closed', async () => {
            const descendantOfNoteId = this.$descendantOf.getSelectedNoteId();

            await this.setAttribute('relation', 'descendantOf', descendantOfNoteId);
        });

        this.$widget.on('click', '[data-search-option-add]', async event => {
            const searchOption = $(event.target).attr('data-search-option-add');

            if (searchOption === 'fastSearch') {
                await this.setAttribute('label', 'fastSearch');
            }
            else if (searchOption === 'orderBy') {
                await this.setAttribute('label', 'orderBy', 'relevancy');
                await this.setAttribute('label', 'orderDirection', 'asc');
            }
            else if (searchOption === 'includeArchivedNotes') {
                await this.setAttribute('label', 'includeArchivedNotes');
            }
            else if (searchOption === 'descendantOf') {
                await this.setAttribute('relation', 'descendantOf', 'root');
            }

            this.refresh();
        });

        this.$widget.on('click', '[data-search-option-del]', async event => {
            async function deleteAttr(note, attrName) {
                for (const attr of note.getOwnedAttributes()) {
                    if (attr.name === attrName) {
                        await server.remove(`notes/${note.noteId}/attributes/${attr.attributeId}`);
                    }
                }
            }

            const searchOption = $(event.target).attr('data-search-option-del');

            await deleteAttr(this.note, searchOption);

            if (searchOption === 'orderBy') {
                await deleteAttr(this.note, 'orderDirection');
            }

            await ws.waitForMaxKnownEntityChangeId();

            this.refresh();
        });

        this.$orderBy = this.$widget.find('select[name=orderBy]');
        this.$orderBy.on('change', async () => {
            const orderBy = this.$orderBy.val();

            await this.setAttribute('label', 'orderBy', orderBy);
        });

        this.$orderDirection = this.$widget.find('select[name=orderDirection]');
        this.$orderDirection.on('change', async () => {
            const orderDirection = this.$orderDirection.val();

            await this.setAttribute('label', 'orderDirection', orderDirection);
        });
    }

    async setAttribute(type, name, value = '') {
        await server.put(`notes/${this.noteId}/set-attribute`, {
            type,
            name,
            value
        });

        await ws.waitForMaxKnownEntityChangeId();
    }

    async refreshResults() {
        await treeCache.reloadNotes([this.noteId]);
    }

    async refreshWithNote(note) {
        this.$component.show();
        this.$searchString.val(this.note.getLabelValue('searchString'));

        for (const attrName of ['includeArchivedNotes', 'descendantOf', 'fastSearch', 'orderBy']) {
            const has = note.hasLabel(attrName) || note.hasRelation(attrName);

            this.$widget.find(`[data-search-option-add='${attrName}'`).toggle(!has);
            this.$widget.find(`[data-search-option-conf='${attrName}'`).toggle(has);
        }

        const descendantOfNoteId = this.note.getRelationValue('descendantOf');
        const descendantOfNote = descendantOfNoteId ? await treeCache.getNote(descendantOfNoteId, true) : null;

        this.$descendantOf
            .val(descendantOfNote ? descendantOfNote.title : "")
            .setSelectedNotePath(descendantOfNoteId);


        if (note.hasLabel('orderBy')) {
            this.$orderBy.val(note.getLabelValue('orderBy'));
            this.$orderDirection.val(note.getLabelValue('orderDirection') || 'asc');
        }

        this.refreshResults(); // important specifically when this search note was not yet refreshed
    }

    focusOnSearchDefinitionEvent() {
        this.$searchString.focus();
    }

    getContent() {
        return '';
    }
}
