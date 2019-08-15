import StandardWidget from "./standard_widget.js";

const TPL = `
<table class="note-info-table">
    <tr>
        <th>Note ID</th>
        <td class="note-info-note-id"></td>
    </tr>
    <tr>
        <th>Created</th>
        <td class="note-info-date-created"></td>
    </tr>
    <tr>
        <th>Modified</th>
        <td class="note-info-date-modified"></td>
    </tr>
    <tr>
        <th>Type</th>
        <td class="note-info-type"></td>
    </tr>
    <tr>
        <th>MIME</th>
        <td class="note-info-mime"></td>
    </tr>
</table>
`;

class NoteInfoWidget extends StandardWidget {
    /**
     * @param {TabContext} ctx
     * @param {object} state
     */
    constructor(ctx, state) {
        super(ctx, state, 'note-info');

        this.$title.text("Note info");
    }

    async doRenderBody() {
        this.$body.html(TPL);

        const $noteId = this.$body.find(".note-info-note-id");
        const $dateCreated = this.$body.find(".note-info-date-created");
        const $dateModified = this.$body.find(".note-info-date-modified");
        const $type = this.$body.find(".note-info-type");
        const $mime = this.$body.find(".note-info-mime");

        const note = this.ctx.note;

        $noteId.text(note.noteId);
        $dateCreated.text(note.dateCreated);
        $dateModified.text(note.dateModified);
        $type.text(note.type);
        $mime.text(note.mime);
    }

    syncDataReceived(syncData) {
        if (syncData.find(sd => sd.entityName === 'notes' && sd.entityId === this.ctx.note.noteId)) {
            this.doRenderBody();
        }
    }
}

export default NoteInfoWidget;