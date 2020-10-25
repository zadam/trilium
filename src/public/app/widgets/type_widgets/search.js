import TypeWidget from "./type_widget.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";
import SpacedUpdate from "../../services/spaced_update.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";
import NoteListRenderer from "../../services/note_list_renderer.js";

const TPL = `
<div class="note-detail-search note-detail-printable">
    <style>
    .note-detail-search {
        padding: 7px;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    
    .search-setting-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px;
    }
    
    .search-setting-expander {
        display: flex; 
        flex-direction: row; 
        color: var(--muted-text-color); 
        font-size: 90%;
        margin: 3px 0 3px 0; 
    }
    
    .attribute-list hr {
        height: 1px;
        border-color: var(--main-border-color);
        position: relative;
        top: 4px;
        margin-top: 5px;
        margin-bottom: 0;
    }
    
    .search-setting-expander-text {
        padding-left: 20px;
        padding-right: 20px;
        white-space: nowrap;
    }
    
    .search-setting-expander:hover {
        cursor: pointer;
    }
    
    .search-setting-expander:hover hr {
        border-color: var(--main-text-color);
    }
    
    .search-setting-expander:hover .search-setting-expander-text {
        color: var(--main-text-color);
    }
    
    .note-result-wrapper {
        height: 100%;
        overflow: auto;
    }
    </style>

    <div class="area-expander">
        <hr class="w-100">
        
        <div class="area-expander-text">Search settings</div>
        
        <hr class="w-100">
    </div>

    <div class="search-settings">
        <table class="search-setting-table">
            <tr>
                <td>Search string:</td>
                <td colspan="3">
                    <input type="text" class="form-control search-string">
                </td>
            </tr>
            <tr>
                <td>Limit search to subtree:</td>
                <td>
                    <div class="input-group">
                        <input class="limit-search-to-subtree form-control" placeholder="search for note by its name">
                    </div>
                </td>
                <td colspan="2" style="padding-top: 9px;">
                    <label title="By choosing to take into acount also note content, search can be slightly slower">
                        <input class="search-within-note-content" value="1" type="checkbox" checked>
    
                        Search also within note content
                    </label>
                </td>
            </tr>
        </table>

        <hr class="w-100 search-setting-empty-expander" style="margin-bottom: 10px;">
    </div>
    
    <div class="note-result-wrapper"></div>
</div>`;

export default class SearchTypeWidget extends TypeWidget {
    static getType() { return "search"; }

    doRender() {
        this.$widget = $(TPL);
        this.$searchString = this.$widget.find(".search-string");
        this.$searchString.on('input', () => this.spacedUpdate.scheduleUpdate());

        this.$component = this.$widget.find('.note-detail-search');

        this.$settingsArea = this.$widget.find('.search-settings');

        this.spacedUpdate = new SpacedUpdate(() => this.updateSearch(), 2000);

        this.$limitSearchToSubtree = this.$widget.find('.limit-search-to-subtree');
        noteAutocompleteService.initNoteAutocomplete(this.$limitSearchToSubtree);

        this.$limitSearchToSubtree.on('autocomplete:closed', e => {
            this.spacedUpdate.scheduleUpdate();
        });

        this.$searchWithinNoteContent = this.$widget.find('.search-within-note-content');
        this.$searchWithinNoteContent.on('change', () => {
            this.spacedUpdate.scheduleUpdate();
        });

        this.$settingExpander = this.$widget.find('.area-expander');
        this.$settingExpander.on('click', async () => {
            const collapse = this.$settingsArea.is(":visible");

            if (collapse) {
                this.$settingsArea.slideUp(200);
            } else {
                this.$settingsArea.slideDown(200);
            }
        });

        this.$noteResultWrapper = this.$widget.find('.note-result-wrapper');
    }

    async updateSearch() {
        const searchString = this.$searchString.val();
        const subNoteId = this.$limitSearchToSubtree.getSelectedNoteId();
        const includeNoteContent = this.$searchWithinNoteContent.is(":checked");

        const response = await server.get(`search/${encodeURIComponent(searchString)}?includeNoteContent=${includeNoteContent}&excludeArchived=true&fuzzyAttributeSearch=false`);

        if (!response.success) {
            toastService.showError("Search failed: " + response.message, 10000);
            // even in this case we'll show the results
        }

        const resultNoteIds = response.results.map(res => res.notePathArray[res.notePathArray.length - 1]);

        const noteListRenderer = new NoteListRenderer(this.note, resultNoteIds);

        this.$noteResultWrapper.empty().append(await noteListRenderer.renderList());
    }

    async doRefresh(note) {
        this.$component.show();

        // try {
        //     const noteComplement = await this.tabContext.getNoteComplement();
        //     const json = JSON.parse(noteComplement.content);
        //
        //     this.$searchString.val(json.searchString);
        // }
        // catch (e) {
        //     console.log(e);
        //     this.$searchString.val('');
        // }
    }

    getContent() {
        return JSON.stringify({
            searchString: this.$searchString.val()
        });
    }
}
