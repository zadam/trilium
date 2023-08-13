import NoteContextAwareWidget from "./note_context_aware_widget.js";
import NoteListRenderer from "../services/note_list_renderer.js";

const TPL = `
<div class="note-list-widget">
    <style>
    .note-list-widget {
        min-height: 0;
        overflow: auto;
    }
    
    .note-list-widget .note-list {
        padding: 10px;
    }
    </style>
    
    <div class="note-list-widget-content">
    </div>
</div>`;

export default class NoteListWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled() && this.noteContext.hasNoteList();
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$content = this.$widget.find('.note-list-widget-content');

        const observer = new IntersectionObserver(entries => {
            this.isIntersecting = entries[0].isIntersecting;

            this.checkRenderStatus();
        }, {
            rootMargin: '50px',
            threshold: 0.1
        });

        // there seems to be a race condition on Firefox which triggers the observer only before the widget is visible
        // (intersection is false). https://github.com/zadam/trilium/issues/4165
        setTimeout(() => observer.observe(this.$widget[0]), 10);
    }

    checkRenderStatus() {
        // console.log("this.isIntersecting", this.isIntersecting);
        // console.log(`${this.noteIdRefreshed} === ${this.noteId}`, this.noteIdRefreshed === this.noteId);
        // console.log("this.shownNoteId !== this.noteId", this.shownNoteId !== this.noteId);

        if (this.isIntersecting
            && this.noteIdRefreshed === this.noteId
            && this.shownNoteId !== this.noteId) {

            this.shownNoteId = this.noteId;
            this.renderNoteList(this.note);
        }
    }

    async renderNoteList(note) {
        const noteListRenderer = new NoteListRenderer(this.$content, note, note.getChildNoteIds());
        await noteListRenderer.renderList();
    }

    async refresh() {
        this.shownNoteId = null;

        await super.refresh();
    }

    async refreshNoteListEvent({noteId}) {
        if (this.isNote(noteId)) {
            await this.renderNoteList(this.note);
        }
    }

    /**
     * We have this event so that we evaluate intersection only after note detail is loaded.
     * If it's evaluated before note detail, then it's clearly intersected (visible) although after note detail load
     * it is not intersected (visible) anymore.
     */
    noteDetailRefreshedEvent({ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        this.noteIdRefreshed = this.noteId;

        setTimeout(() => this.checkRenderStatus(), 100);
    }

    notesReloadedEvent({noteIds}) {
        if (noteIds.includes(this.noteId)) {
            this.refresh();
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributeRows().find(attr => attr.noteId === this.noteId && ['viewType', 'expanded', 'pageSize'].includes(attr.name))) {
            this.shownNoteId = null; // force render

            this.checkRenderStatus();
        }
    }
}
