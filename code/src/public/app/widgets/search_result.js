import NoteContextAwareWidget from "./note_context_aware_widget.js";
import NoteListRenderer from "../services/note_list_renderer.js";

const TPL = `
<div class="search-result-widget">
    <style>
    .search-result-widget {
        flex-grow: 100000;
        flex-shrink: 100000;
        min-height: 0;
        overflow: auto;
    }
    
    .search-result-widget .note-list {
        padding: 10px;
    }
    
    .search-no-results, .search-not-executed-yet {
        margin: 20px;
        padding: 20px;
    }
    </style>
    
    <div class="search-no-results alert alert-info">
        No notes have been found for given search parameters.
    </div>
    
    <div class="search-not-executed-yet alert alert-info">
        Search has not been executed yet. Click on "Search" button above to see the results.
    </div>
    
    <div class="search-result-widget-content">
    </div>
</div>`;

export default class SearchResultWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && this.note.type === 'search';
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$content = this.$widget.find('.search-result-widget-content');
        this.$noResults = this.$widget.find('.search-no-results');
        this.$notExecutedYet = this.$widget.find('.search-not-executed-yet');
    }

    async refreshWithNote(note) {
        this.$content.empty();
        this.$noResults.toggle(note.getChildNoteIds().length === 0 && !!note.searchResultsLoaded);
        this.$notExecutedYet.toggle(!note.searchResultsLoaded);

        const noteListRenderer = new NoteListRenderer(this.$content, note, note.getChildNoteIds(), true);
        await noteListRenderer.renderList();
    }

    searchRefreshedEvent({ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        this.refresh();
    }

    notesReloadedEvent({noteIds}) {
        if (noteIds.includes(this.noteId)) {
            this.refresh();
        }
    }
}
