import server from "../../services/server.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import froca from "../../services/froca.js";
import ws from "../../services/ws.js";
import toastService from "../../services/toast.js";
import treeService from "../../services/tree.js";

import DeleteNoteSearchAction from "../search_actions/delete_note.js";
import DeleteLabelSearchAction from "../search_actions/delete_label.js";
import DeleteRelationSearchAction from "../search_actions/delete_relation.js";
import RenameLabelSearchAction from "../search_actions/rename_label.js";
import SetLabelValueSearchAction from "../search_actions/set_label_value.js";
import SetRelationTargetSearchAction from "../search_actions/set_relation_target.js";
import RenameRelationSearchAction from "../search_actions/rename_relation.js";
import ExecuteScriptSearchAction from "../search_actions/execute_script.js"
import SearchString from "../search_options/search_string.js";
import FastSearch from "../search_options/fast_search.js";
import Ancestor from "../search_options/ancestor.js";
import IncludeArchivedNotes from "../search_options/include_archived_notes.js";
import OrderBy from "../search_options/order_by.js";
import SearchScript from "../search_options/search_script.js";
import Limit from "../search_options/limit.js";
import DeleteNoteRevisionsSearchAction from "../search_actions/delete_note_revisions.js";
import Debug from "../search_options/debug.js";
import appContext from "../../services/app_context.js";
import MoveNoteSearchAction from "../search_actions/move_note.js";

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
                      <div class="dropdown-menu">
                        <a class="dropdown-item" href="#" data-action-add="moveNote">
                            Move note</a>
                        <a class="dropdown-item" href="#" data-action-add="deleteNote">
                            Delete note</a>
                        <a class="dropdown-item" href="#" data-action-add="deleteNoteRevisions">
                            Delete note revisions</a>
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

const ACTION_CLASSES = {};

for (const clazz of [
    MoveNoteSearchAction,
    DeleteNoteSearchAction,
    DeleteNoteRevisionsSearchAction,
    DeleteLabelSearchAction,
    DeleteRelationSearchAction,
    RenameLabelSearchAction,
    RenameRelationSearchAction,
    SetLabelValueSearchAction,
    SetRelationTargetSearchAction,
    ExecuteScriptSearchAction
]) {
    ACTION_CLASSES[clazz.actionName] = clazz;
}

export default class SearchDefinitionWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note && this.note.type === 'search';
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            activate: true,
            title: 'Search parameters',
            icon: 'bx bx-search'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$component = this.$widget.find('.search-definition-widget');

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

            toastService.showMessage("Search note has been saved into " + await treeService.getNotePathTitle(notePath));
        });
    }

    async refreshResultsCommand() {
        try {
            await froca.loadSearchNote(this.noteId);
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

        this.$saveToNoteButton.toggle(!note.getAllNotePaths().find(notePathArr => !notePathArr.includes("hidden")));

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

            const action = new ActionClass(actionAttr, actionDef).setParent(this);
            this.child(action);

            this.$actionOptions.append(action.render());
        }

        this.$searchAndExecuteButton.css('visibility', actionLabels.length > 0 ? 'visible' : 'hidden');
    }

    getContent() {
        return '';
    }

    async searchAndExecute() {
        await server.post(`search-and-execute-note/${this.noteId}`);

        this.triggerCommand('refreshResults');

        toastService.showMessage('Actions have been executed.', 3000);
    }
}
