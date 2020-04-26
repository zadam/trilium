import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-read-only-code note-detail-printable">
    <style>
    .note-detail-read-only-code {
        overflow: auto;
        height: 100%;
    }
    
    .note-detail-read-only-code-content {
        padding: 10px;
    }
    </style>

    <div class="alert alert-warning no-print" style="margin-bottom: 0;">
        Read only code view is shown. <a href="#" class="edit-note">Click here</a> to edit the note.
    </div>

    <pre class="note-detail-read-only-code-content"></pre>
</div>`;

export default class ReadOnlyCodeTypeWidget extends TypeWidget {
    static getType() { return "read-only-code"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find('.note-detail-read-only-code-content');

        this.$widget.find('a.edit-note').on('click', () => {
            this.tabContext.codePreviewDisabled = true;

            this.triggerEvent('codePreviewDisabled', {tabContext: this.tabContext});
        });

        return this.$widget;
    }

    async doRefresh(note) {
        const noteComplement = await this.tabContext.getNoteComplement();

        this.$content.text(noteComplement.content);
    }
}