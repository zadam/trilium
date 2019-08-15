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

class NoteInfoWidget {
    /**
     * @param {TabContext} ctx
     * @param {jQuery} $widget
     */
    constructor(ctx, $widget) {
        this.ctx = ctx;
        this.$widget = $widget;
        this.$widget.on('show.bs.collapse', () => this.renderBody());
        this.$widget.on('show.bs.collapse', () => this.ctx.stateChanged());
        this.$widget.on('hide.bs.collapse', () => this.ctx.stateChanged());
        this.$title = this.$widget.find('.widget-title');
        this.$title.text("Note info");
        this.$bodyWrapper = this.$widget.find('.body-wrapper');
    }

    async renderBody() {
        if (!this.isVisible()) {
            return;
        }

        const $body = this.$widget.find('.card-body');

        $body.html(TPL);

        const $noteId = $body.find(".note-info-note-id");
        const $dateCreated = $body.find(".note-info-date-created");
        const $dateModified = $body.find(".note-info-date-modified");
        const $type = $body.find(".note-info-type");
        const $mime = $body.find(".note-info-mime");

        const note = this.ctx.note;

        $noteId.text(note.noteId);
        $dateCreated.text(note.dateCreated);
        $dateModified.text(note.dateModified);
        $type.text(note.type);
        $mime.text(note.mime);
    }

    syncDataReceived(syncData) {
        if (syncData.find(sd => sd.entityName === 'notes' && sd.entityId === this.ctx.note.noteId)) {
            this.renderBody();
        }
    }

    getWidgetState() {
        return {
            id: 'attributes',
            visible: this.isVisible()
        };
    }

    isVisible() {
        return this.$bodyWrapper.is(":visible");
    }
}

export default NoteInfoWidget;