import TabAwareWidget from "./tab_aware_widget.js";
import NoteListRenderer from "../services/note_list_renderer.js";
import utils from "../services/utils.js";

const TPL = `
<div class="note-list-widget">
    <style>
    .note-list-widget {
        flex-grow: 100000;
        flex-shrink: 100000;
        min-height: 0;
        padding: 0 10px 10px 10px;
    }
    </style>
    
    <div class="note-list-widget-content">
    </div>
</div>`;

export default class NoteListWidget extends TabAwareWidget {
    isEnabled() {
        return super.isEnabled() && (
            ['book', 'search'].includes(this.note.type)
            || (this.note.type === 'text' && this.note.hasChildren())
        );
    }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find('.note-list-widget-content');
        this.contentSized();
    }

    async refreshWithNote(note) {
        const noteListRenderer = new NoteListRenderer(note, note.getChildNoteIds());

        this.$content.empty().append(await noteListRenderer.renderList());
    }

    autoBookDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }

    searchResultsUpdatedEvent({searchNoteIds}) {
        if (searchNoteIds.includes(this.noteId)) {
            this.refresh();
        }
    }
}
