import TabAwareWidget from "./tab_aware_widget.js";
import NoteListRenderer from "../services/note_list_renderer.js";

const TPL = `
<div class="note-list-widget">
<style>
.note-list-widget {
    flex-grow: 100000;
    padding: 0 10px 10px 10px;
}
</style>

</div>`;

export default class NoteListWidget extends TabAwareWidget {
    isEnabled() {
        return super.isEnabled() && !this.tabContext.autoBookDisabled && (
            ['book', 'search'].includes(this.note.type)
            || (this.note.type === 'text' && this.note.hasChildren())
        );
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
    }

    async refreshWithNote(note) {
        const noteListRenderer = new NoteListRenderer(note, note.getChildNoteIds());

        this.$widget.empty().append(await noteListRenderer.renderList());
    }

    autoBookDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }
}
