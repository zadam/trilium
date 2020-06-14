import treeCache from "../../services/tree_cache.js";
import AbstractTextTypeWidget from "./abstract_text_type_widget.js";
import treeService from "../../services/tree.js";

const TPL = `
<div class="note-detail-readonly-text note-detail-printable">
    <style>
    .note-detail-readonly-text h1 { font-size: 2.0em; }
    .note-detail-readonly-text h2 { font-size: 1.8em; }
    .note-detail-readonly-text h3 { font-size: 1.6em; }
    .note-detail-readonly-text h4 { font-size: 1.4em; }
    .note-detail-readonly-text h5 { font-size: 1.2em; }
    .note-detail-readonly-text h6 { font-size: 1.1em; }
    
    .note-detail-readonly-text {
        overflow: auto;
        height: 100%;
        padding: 10px;
        font-family: var(--detail-text-font-family);
    }
        
    .note-detail-readonly-text p:first-child, .note-detail-text::before {
        margin-top: 0;
    }
    
    .note-detail-readonly-text img {
        max-width: 100%;
    }
    </style>

    <div class="alert alert-warning no-print">
        Read only text view is shown. <a href="#" class="edit-note">Click here</a> to edit the note.
    </div>

    <div class="note-detail-readonly-text-content ck-content"></div>
</div>
`;

export default class ReadOnlyTextTypeWidget extends AbstractTextTypeWidget {
    static getType() { return "read-only-text"; }

    doRender() {
        this.$widget = $(TPL);

        this.$content = this.$widget.find('.note-detail-readonly-text-content');

        this.$widget.find('a.edit-note').on('click', () => {
            this.tabContext.textPreviewDisabled = true;

            this.triggerEvent('textPreviewDisabled', {tabContext: this.tabContext});
        });

        super.doRender();

        return this.$widget;
    }

    cleanup() {
        this.$content.html('');
    }

    scrollToTop() {
        this.$content.scrollTop(0);
    }

    async doRefresh(note) {
        const noteComplement = await treeCache.getNoteComplement(note.noteId);

        this.$content.html(noteComplement.content);

        this.$content.find("a.reference-link").each(async (_, el) => {
            const notePath = $(el).attr('href');
            const noteId = treeService.getNoteIdFromNotePath(notePath);

            this.loadReferenceLinkTitle(noteId, $(el));
        });

        this.$content.find("section").each(async (_, el) => {
            const noteId = $(el).attr('data-note-id');

            this.loadIncludedNote(noteId, $(el));
        });
    }

    async refreshIncludedNoteEvent({noteId}) {
        this.refreshIncludedNote(this.$content, noteId);
    }
}
