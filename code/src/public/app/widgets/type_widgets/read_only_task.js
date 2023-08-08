import AbstractTaskTypeWidget from "./abstract_task_type_widget.js";
import libraryLoader from "../../services/library_loader.js";

const TPL = `
<div class="note-detail-readonly-task note-detail-printable">
    <style>
    /* h1 should not be used at all since semantically that's a note title */
    .note-detail-readonly-task h1 { font-size: 1.8em; }
    .note-detail-readonly-task h2 { font-size: 1.6em; }
    .note-detail-readonly-task h3 { font-size: 1.4em; }
    .note-detail-readonly-task h4 { font-size: 1.2em; }
    .note-detail-readonly-task h5 { font-size: 1.1em; }
    .note-detail-readonly-task h6 { font-size: 1.0em; }
    
    body.heading-style-markdown .note-detail-readonly-task h1::before { content: "#\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-task h2::before { content: "##\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-task h3::before { content: "###\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-task h4:not(.include-note-title)::before { content: "####\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-task h5::before { content: "#####\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-readonly-task h6::before { content: "######\\2004"; color: var(--muted-text-color); }

    body.heading-style-underline .note-detail-readonly-task h1 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-readonly-task h2 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-readonly-task h3 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-readonly-task h4:not(.include-note-title) { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-readonly-task h5 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-readonly-task h6 { border-bottom: 1px solid var(--main-border-color); }
    
    .note-detail-readonly-task {
        padding-left: 24px;
        padding-top: 10px;
        font-family: var(--detail-font-family);
        min-height: 50px;
        position: relative;
    }
    
    body.mobile .note-detail-readonly-task {
        padding-left: 10px;
    }
        
    .note-detail-readonly-task p:first-child, .note-detail-readonly-task::before {
        margin-top: 0;
    }
    
    .note-detail-readonly-task img {
        max-width: 100%;
        cursor: pointer;
    }
    
    .edit-task-note-button {
        position: absolute; 
        top: 5px;
        right: 10px;
        font-size: 150%;
        padding: 5px;
        cursor: pointer;
        border: 1px solid transparent;
        border-radius: var(--button-border-radius);
        color: var(--button-text-color);
    }
    
    .edit-task-note-button:hover {
        border-color: var(--button-border-color);
    }
    </style>

    <div class="note-detail-readonly-task-content ck-content"></div>
</div>
`;

export default class ReadOnlyTaskTypeWidget extends AbstractTaskTypeWidget {
    static getType() { return "readOnlyTask"; }

    doRender() {
        this.$widget = $(TPL);

        this.$content = this.$widget.find('.note-detail-readonly-task-content');

        this.setupImageOpening(true);

        super.doRender();
    }

    cleanup() {
        this.$content.html('');
    }

    async doRefresh(note) {
        // we load CKEditor also for read only notes because they contain content styles required for correct rendering of even read only notes
        // we could load just ckeditor-content.css but that causes CSS conflicts when both build CSS and this content CSS is loaded at the same time
        // (see https://github.com/zadam/trilium/issues/1590 for example of such conflict)
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        const blob = await note.getBlob();

        this.$content.html(blob.content);

        this.$content.find("a.reference-link").each(async (_, el) => {
            this.loadReferenceLinkTitle($(el));
        });

        this.$content.find("section").each(async (_, el) => {
            const noteId = $(el).attr('data-note-id');

            this.loadIncludedNote(noteId, $(el));
        });

        if (this.$content.find('span.math-tex').length > 0) {
            await libraryLoader.requireLibrary(libraryLoader.KATEX);

            renderMathInElement(this.$content[0], {trust: true});
        }
    }

    async refreshIncludedNoteEvent({noteId}) {
        this.refreshIncludedNote(this.$content, noteId);
    }

    async executeWithContentElementEvent({resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        resolve(this.$content);
    }
}
