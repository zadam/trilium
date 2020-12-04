import TypeWidget from "./type_widgets/type_widget.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import toastService from "../services/toast.js";
import NoteListRenderer from "../services/note_list_renderer.js";
import TabAwareWidget from "./tab_aware_widget.js";
import treeCache from "../services/tree_cache.js";

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
        this.contentSized();
        this.$searchString = this.$widget.find(".search-string");
        this.$searchString.on('input', () => this.spacedUpdate.scheduleUpdate());

        this.$component = this.$widget.find('.search-definition-widget');

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
    }

    async updateSearch() {
        const searchString = this.$searchString.val();
        const subNoteId = this.$limitSearchToSubtree.getSelectedNoteId();
        const includeNoteContent = this.$searchWithinNoteContent.is(":checked");

        await server.put(`notes/${this.noteId}/attributes`, [
            { type: 'label', name: 'searchString', value: searchString },
            { type: 'label', name: 'includeNoteContent', value: includeNoteContent ? 'true' : 'false' },
            subNoteId ? { type: 'label', name: 'subTreeNoteId', value: subNoteId } : undefined,
        ].filter(it => !!it));

        if (this.note.title.startsWith('Search: ')) {
            await server.put(`notes/${this.noteId}/change-title`, {
                title: 'Search: ' + (searchString.length < 30 ? searchString : `${searchString.substr(0, 30)}…`)
            });
        }

        await this.refreshResults();
    }

    async refreshResults() {
        await treeCache.reloadNotes([this.noteId]);
    }

    async refreshWithNote(note) {
        this.$component.show();
        this.$searchString.val(this.note.getLabelValue('searchString'));
        this.$searchWithinNoteContent.prop('checked', this.note.getLabelValue('includeNoteContent') === 'true');
        this.$limitSearchToSubtree.val(this.note.getLabelValue('subTreeNoteId'));

        this.refreshResults(); // important specifically when this search note was not yet refreshed
    }

    focusOnSearchDefinitionEvent() {
        this.$searchString.focus();
    }

    getContent() {
        return JSON.stringify({
            searchString: this.$searchString.val()
        });
    }
}
