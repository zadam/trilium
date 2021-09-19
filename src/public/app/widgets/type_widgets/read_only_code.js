import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-read-only-code note-detail-printable">
    <style>
    .note-detail-read-only-code {
        position: relative;
        min-height: 50px;
    }
    
    .note-detail-read-only-code-content {
        padding: 10px;
    }
    
    .edit-code-note-button {
        position: absolute; 
        top: 5px; 
        right: 10px;
        font-size: 130%;
        cursor: pointer;
    }
    </style>

    <div class="alert alert-warning no-print edit-code-note-button bx bx-edit-alt"
         title="Edit this note"></div>

    <pre class="note-detail-read-only-code-content"></pre>
</div>`;

export default class ReadOnlyCodeTypeWidget extends TypeWidget {
    static getType() { return "read-only-code"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$content = this.$widget.find('.note-detail-read-only-code-content');

        this.$widget.find('.edit-code-note-button').on('click', () => {
            this.tabContext.codePreviewDisabled = true;

            this.triggerEvent('codePreviewDisabled', {tabContext: this.tabContext});
        });
    }

    async doRefresh(note) {
        const noteComplement = await this.tabContext.getNoteComplement();

        this.$content.text(noteComplement.content);
    }
}
