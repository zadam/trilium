import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import treeCache from "../../services/tree_cache.js";

const TPL = `
<div class="note-detail-text-preview note-detail-printable">
    <style>
    .note-detail-text-preview h1 { font-size: 2.0em; }
    .note-detail-text-preview h2 { font-size: 1.8em; }
    .note-detail-text-preview h3 { font-size: 1.6em; }
    .note-detail-text-preview h4 { font-size: 1.4em; }
    .note-detail-text-preview h5 { font-size: 1.2em; }
    .note-detail-text-preview h6 { font-size: 1.1em; }
    
    .note-detail-text-preview {
        overflow: auto;
        height: 100%;
        padding: 10px;
        font-family: var(--detail-text-font-family);
    }
        
    .note-detail-text-preview p:first-child, .note-detail-text::before {
        margin-top: 0;
    }
    </style>

    <div class="alert alert-warning" title="This note is long so for performance reasons only text preview is shown by default.">
        Text preview is shown. <a href="#" class="edit-note">Click here</a> to edit the note.
    </div>

    <div class="note-detail-text-preview-content"></div>
</div>
`;

export default class TextPreviewTypeWidget extends TypeWidget {
    static getType() { return "text-preview"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find('.note-detail-text-preview-content');

        this.$widget.on("dblclick", "img", e => {
            const $img = $(e.target);
            const src = $img.prop("src");

            const match = src.match(/\/api\/images\/([A-Za-z0-9]+)\//);

            if (match) {
                const noteId = match[1];

                appContext.tabManager.getActiveTabContext().setNote(noteId);
            }
            else {
                window.open(src, '_blank');
            }
        });

        this.$widget.find('a.edit-note').on('click', () => {
            this.tabContext.textPreviewDisabled = true;

            this.triggerEvent('textPreviewDisabled', {tabContext: this.tabContext});
        });

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
    }
}