import noteAutocompleteService from "../services/note_autocomplete.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import TabAwareWidget from "./tab_aware_widget.js";
import treeCache from "../services/tree_cache.js";
import ws from "../services/ws.js";
import utils from "../services/utils.js";
import DeleteNoteSearchAction from "./search_actions/delete_note.js";
import DeleteLabelSearchAction from "./search_actions/delete_label.js";
import DeleteRelationSearchAction from "./search_actions/delete_relation.js";
import RenameLabelSearchAction from "./search_actions/rename_label.js";
import SetLabelValueSearchAction from "./search_actions/set_label_value.js";
import SetRelationTargetSearchAction from "./search_actions/set_relation_target.js";

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
                    <button type="button" class="btn btn-sm" data-search-option-add="ancestor">
                        <span class="bx bx-filter-alt"></span> 
                        ancestor
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
                      <button class="btn btn-sm dropdown-toggle action-add-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <span class="bx bxs-zap"></span>
                        action
                      </button>
                      <div class="dropdown-menu">
                        <a class="dropdown-item" href="#" data-action-add="deleteNote">
                            Delete note</a>
                        <a class="dropdown-item" href="#" data-action-add="deleteLabel">
                            Delete label</a>
                        <a class="dropdown-item" href="#" data-action-add="deleteRelation">
                            Delete relation</a>
                        <a class="dropdown-item" href="#" data-action-add="renameLabel">
                            Rename label</a>
                        <a class="dropdown-item" href="#" data-action-add="renameRelation">
                            Rename relation</a>
                        <a class="dropdown-item" href="#" data-action-add="setLabelValue">
                            Set label value</a>
                        <a class="dropdown-item" href="#" data-action-add="setRelationTarget">
                            Set relation target</a>
                        <a class="dropdown-item" href="#" data-action-add="executeScript">
                            Execute script</a>
                      </div>
                    </div>
                </td>
            </tr>
            <tbody class="search-options">
                <tr data-search-option-conf="ancestor">
                    <td title="Matched notes must be within subtree of given note.">
                        Ancestor: </td>
                    <td>
                        <div class="input-group">
                            <input class="ancestor form-control" placeholder="search for note by its name">
                        </div>
                    </td>
                    <td>
                        <span class="bx bx-x icon-action" data-search-option-del="ancestor"></span>
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
            <tbody class="action-options"></tbody>
            <tbody>
                <tr>
                    <td colspan="3">
                        <div style="display: flex; justify-content: space-evenly">
                            <button type="button" class="btn btn-sm search-button">
                                <span class="bx bx-search"></span>
                                Search
                                
                                <kbd>enter</kbd>
                            </button>
        
                            <button type="button" class="btn btn-sm search-and-execute-button">
                                <span class="bx bxs-zap"></span>
                                Search & Execute actions
                            </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>`;

const ACTION_CLASSES = {};

for (const clazz of [
    DeleteNoteSearchAction,
    DeleteLabelSearchAction,
    DeleteRelationSearchAction,
    RenameLabelSearchAction,
    SetLabelValueSearchAction,
    SetRelationTargetSearchAction
]) {
    ACTION_CLASSES[clazz.actionName] = clazz;
}

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
        utils.bindElShortcut(this.$searchString, 'return', async () => {
            await this.searchStringSU.updateNowIfNecessary();

            this.refreshResults();
        });

        this.searchStringSU = new SpacedUpdate(async () => {
            const searchString = this.$searchString.val();

            await this.setAttribute('label', 'searchString', searchString);

            if (this.note.title.startsWith('Search: ')) {
                await server.put(`notes/${this.noteId}/change-title`, {
                    title: 'Search: ' + (searchString.length < 30 ? searchString : `${searchString.substr(0, 30)}…`)
                });
            }
        }, 1000);

        this.$ancestor = this.$widget.find('.ancestor');
        noteAutocompleteService.initNoteAutocomplete(this.$ancestor);

        this.$ancestor.on('autocomplete:closed', async () => {
            const ancestorOfNoteId = this.$ancestor.getSelectedNoteId();

            await this.setAttribute('relation', 'ancestor', ancestorOfNoteId);
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
            else if (searchOption === 'ancestor') {
                await this.setAttribute('relation', 'ancestor', 'root');
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

        this.$actionOptions = this.$widget.find('.action-options');

        this.$widget.on('click', '[data-action-add]', async event => {
            const actionName = $(event.target).attr('data-action-add');

            await server.post(`notes/${this.noteId}/attributes`, {
                type: 'label',
                name: 'action',
                value: JSON.stringify({
                    name: actionName
                })
            });

            this.$widget.find('.action-add-toggle').dropdown('toggle');

            await ws.waitForMaxKnownEntityChangeId();

            this.refresh();
        });

        this.$widget.on('click', '[data-action-conf-del]', async event => {
            const attributeId = $(event.target).closest('[data-attribute-id]').attr('data-attribute-id');

            await server.remove(`notes/${this.noteId}/attributes/${attributeId}`);

            await ws.waitForMaxKnownEntityChangeId();

            this.refresh();
        });

        this.$searchButton = this.$widget.find('.search-button');
        this.$searchButton.on('click', () => this.refreshResults());

        this.$searchAndExecuteButton = this.$widget.find('.search-and-execute-button');
    }

    async setAttribute(type, name, value = '') {
        await server.put(`notes/${this.noteId}/set-attribute`, { type, name, value });

        await ws.waitForMaxKnownEntityChangeId();
    }

    async refreshResults() {
        await treeCache.reloadNotes([this.noteId]);

        this.triggerEvent('searchRefreshed', {tabId: this.tabContext.tabId});
    }

    async refreshWithNote(note) {
        this.$component.show();
        this.$searchString.val(this.note.getLabelValue('searchString'));

        for (const attrName of ['includeArchivedNotes', 'ancestor', 'fastSearch', 'orderBy']) {
            const has = note.hasLabel(attrName) || note.hasRelation(attrName);

            this.$widget.find(`[data-search-option-add='${attrName}'`).toggle(!has);
            this.$widget.find(`[data-search-option-conf='${attrName}'`).toggle(has);
        }

        const ancestorNoteId = this.note.getRelationValue('ancestor');

        await this.$ancestor.setNote(ancestorNoteId);

        if (note.hasLabel('orderBy')) {
            this.$orderBy.val(note.getLabelValue('orderBy'));
            this.$orderDirection.val(note.getLabelValue('orderDirection') || 'asc');
        }

        this.$actionOptions.empty();

        const actionLabels = this.note.getLabels('action');

        for (const actionAttr of actionLabels) {
            let actionDef;

            try {
                actionDef = JSON.parse(actionAttr.value);
            }
            catch (e) {
                logError(`Parsing of attribute: '${actionAttr.value}' failed with error: ${e.message}`);
                continue;
            }

            const ActionClass = ACTION_CLASSES[actionDef.name];

            if (!ActionClass) {
                logError(`No action class for '${actionDef.name}' found.`);
                continue;
            }

            const action = new ActionClass(actionAttr, actionDef);

            this.$actionOptions.append(action.render());
        }

        this.$searchAndExecuteButton.css('visibility', actionLabels.length > 0 ? 'visible' : 'hidden');

        //this.refreshResults(); // important specifically when this search note was not yet refreshed
    }

    focusOnSearchDefinitionEvent() {
        this.$searchString.focus();
    }

    getContent() {
        return '';
    }
}
