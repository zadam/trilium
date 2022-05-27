import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-readonly-code note-detail-printable">
    <style>
    .note-detail-readonly-code {
        min-height: 50px;
        position: relative;
    }
    
    .note-detail-readonly-code-content {
        padding: 10px;
    }
    </style>

    <pre class="note-detail-readonly-code-content"></pre>
</div>`;

export default class ReadOnlyCodeTypeWidget extends TypeWidget {
    static getType() { return "read-only-code"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find('.note-detail-readonly-code-content');

        super.doRender();
    }

    async doRefresh(note) {
        const noteComplement = await this.noteContext.getNoteComplement();

        this.$content.text(noteComplement.content);
    }

    async executeWithContentElementEvent({resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        resolve(this.$content);
    }
}
