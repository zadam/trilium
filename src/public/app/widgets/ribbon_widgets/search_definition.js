import server from "../../services/server.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import froca from "../../services/froca.js";
import ws from "../../services/ws.js";
import toastService from "../../services/toast.js";
import treeService from "../../services/tree.js";

import SearchString from "../search_options/search_string.js";
import FastSearch from "../search_options/fast_search.js";
import Ancestor from "../search_options/ancestor.js";
import IncludeArchivedNotes from "../search_options/include_archived_notes.js";
import OrderBy from "../search_options/order_by.js";
import SearchScript from "../search_options/search_script.js";
import Limit from "../search_options/limit.js";
import Debug from "../search_options/debug.js";
import appContext from "../../components/app_context.js";
import bulkActionService from "../../services/bulk_action.js";

const TPL = `
<div class="search-definition-widget">
    <style> 
    .search-setting-table {
        margin-top: 0;
        margin-bottom: 7px;
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px;
    }
    
    .search-setting-table div {
        white-space: nowrap;
    }
    
    .search-setting-table .button-column {
        /* minimal width so that table remains static sized and most space remains for middle column with settings */
        width: 50px;
        white-space: nowrap;
        text-align: right;
    }
    
    .search-setting-table .title-column {
        /* minimal width so that table remains static sized and most space remains for middle column with settings */
        width: 50px;
        white-space: nowrap;    
    }
    
    .search-setting-table .button-column .dropdown-menu {
        white-space: normal;
    }
    
    .attribute-list hr {
        height: 1px;
        border-color: var(--main-border-color);
        position: relative;
        top: 4px;
        margin-top: 5px;
        margin-bottom: 0;
    }
    
    .search-definition-widget input:invalid {
        border: 3px solid red;
    }

    .add-search-option button {
        margin-top: 5px; /* to give some spacing when buttons overflow on the next line */
    }
    
    .dropdown-header {
        background-color: var(--accented-background-color);
    }
    </style>

    <div class="search-settings">
        <table class="search-setting-table">
            <tr>
                <td class="title-column">Add search option:</td>
                <td colspan="2" class="add-search-option">
                    <button type="button" class="btn btn-sm" data-search-option-add="searchString">
                        <span class="bx bx-text"></span> 
                        search string
                    </button>
                    
                    <button type="button" class="btn btn-sm" data-search-option-add="searchScript">
                        <span class="bx bx-code"></span> 
                        search script
                    </button>
                    
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
                    
                    <button type="button" class="btn btn-sm" data-search-option-add="limit" title="Limit number of results">
                        <span class="bx bx-stop"></span>
                        limit
                    </button>
                    
                    <button type="button" class="btn btn-sm" data-search-option-add="debug" title="Debug will print extra debugging information into the console to aid in debugging complex queries">
                        <span class="bx bx-bug"></span>
                        debug
                    </button>
                    
                    <div class="dropdown" style="display: inline-block;">
                      <button class="btn btn-sm dropdown-toggle action-add-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <span class="bx bxs-zap"></span>
                        action
                      </button>
                      <div class="dropdown-menu action-list"></div>
                    </div>
                </td>
            </tr>
            <tbody class="search-options"></tbody>
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
                            
                            <button type="button" class="btn btn-sm save-to-note-button">
                                <span class="bx bx-save"></span>
                                Save to note
                            </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>`;

const OPTION_CLASSES = [
    SearchString,
    SearchScript,
    Ancestor,
    FastSearch,
    IncludeArchivedNotes,
    OrderBy,
    Limit,
    Debug
];

export default class SearchDefinitionWidget extends NoteContextAwareWidget {
    get name() {
        return "searchDefinition";
    }

    isEnabled() {
        return this.note && this.note.type === 'search';
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            activate: true,
            title: 'Search Parameters',
            icon: 'bx bx-search'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$component = this.$widget.find('.search-definition-widget');
        this.$actionList = this.$widget.find('.action-list');

        for (const actionGroup of bulkActionService.ACTION_GROUPS) {
            this.$actionList.append($('<h6 class="dropdown-header">').append(actionGroup.title));

            for (const action of actionGroup.actions) {
                this.$actionList.append(
                    $('<a class="dropdown-item" href="#">')
                        .attr('data-action-add', action.actionName)
                        .text(action.actionTitle)
                );
            }
        }

        this.$widget.on('click', '[data-search-option-add]', async event => {
            const searchOptionName = $(event.target).attr('data-search-option-add');
            const clazz = OPTION_CLASSES.find(SearchOptionClass => SearchOptionClass.optionName === searchOptionName);

            if (clazz) {
                await clazz.create(this.noteId);
            }
            else {
                logError(`Unknown search option ${searchOptionName}`);
            }

            this.refresh();
        });

        this.$widget.on('click', '[data-action-add]', async event => {
            this.$widget.find('.action-add-toggle').dropdown('toggle');

            const actionName = $(event.target).attr('data-action-add');

            await bulkActionService.addAction(this.noteId, actionName);

            this.refresh();
        });

        this.$searchOptions = this.$widget.find('.search-options');
        this.$actionOptions = this.$widget.find('.action-options');

        this.$searchButton = this.$widget.find('.search-button');
        this.$searchButton.on('click', () => this.triggerCommand('refreshResults'));

        this.$searchAndExecuteButton = this.$widget.find('.search-and-execute-button');
        this.$searchAndExecuteButton.on('click', () => this.searchAndExecute());

        this.$saveToNoteButton = this.$widget.find('.save-to-note-button');
        this.$saveToNoteButton.on('click', async () => {
            const {notePath} = await server.post("special-notes/save-search-note", {searchNoteId: this.noteId});

            await ws.waitForMaxKnownEntityChangeId();

            await appContext.tabManager.getActiveContext().setNote(notePath);

            toastService.showMessage(`Search note has been saved into ${await treeService.getNotePathTitle(notePath)}`);
        });
    }

    async refreshResultsCommand() {
        try {
            const {error} = await froca.loadSearchNote(this.noteId);

            if (error) {
                this.handleEvent('showSearchError', { error });
            }
        }
        catch (e) {
            toastService.showError(e.message);
        }

        this.triggerEvent('searchRefreshed', {ntxId: this.noteContext.ntxId});
    }

    async refreshSearchDefinitionCommand() {
        await this.refresh();
    }

    async refreshWithNote(note) {
        this.$component.show();

        this.$saveToNoteButton.toggle(note.isHiddenCompletely());

        this.$searchOptions.empty();

        for (const OptionClass of OPTION_CLASSES) {
            const {attributeType, optionName} = OptionClass;

            const attr = this.note.getAttribute(attributeType, optionName);

            this.$widget.find(`[data-search-option-add='${optionName}'`).toggle(!attr);

            if (attr) {
                const searchOption = new OptionClass(attr, this.note).setParent(this);
                this.child(searchOption);

                this.$searchOptions.append(searchOption.render());
            }
        }

        const actions = bulkActionService.parseActions(this.note);

        this.$actionOptions
            .empty()
            .append(...actions.map(action => action.render()));

        this.$searchAndExecuteButton.css('visibility', actions.length > 0 ? 'visible' : '_hidden');
    }

    getContent() {
        return '';
    }

    async searchAndExecute() {
        await server.post(`search-and-execute-note/${this.noteId}`);

        this.triggerCommand('refreshResults');

        toastService.showMessage('Actions have been executed.', 3000);
    }

    entitiesReloadedEvent({loadResults}) {
        // only refreshing deleted attrs, otherwise components update themselves
        if (loadResults.getAttributeRows().find(attrRow =>
            attrRow.type === 'label' && attrRow.name === 'action' && attrRow.isDeleted)) {

            this.refresh();
        }
    }
}
