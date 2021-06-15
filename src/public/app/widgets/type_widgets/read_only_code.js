import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-read-only-code note-detail-printable">
    <style>
    .note-detail-read-only-code {
        min-height: 50px;
    }
    
    .note-detail-read-only-code-content {
        padding: 10px;
    }
    </style>

    <pre class="note-detail-read-only-code-content"></pre>
</div>`;

export default class ReadOnlyCodeTypeWidget extends TypeWidget {
    static getType() { return "read-only-code"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find('.note-detail-read-only-code-content');

        super.doRender();
    }

    async doRefresh(note) {
        const noteComplement = await this.noteContext.getNoteComplement();

        this.$content.text(noteComplement.content);
    }
}
