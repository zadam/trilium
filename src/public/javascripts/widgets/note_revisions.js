import server from "../services/server.js";

const TPL = `
<ul class="note-revision-list" style="max-height: 150px; overflow: auto;">
</ul>
`;

class NoteRevisionsWidget {
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
        this.$title.text("Note revisions");
        this.$bodyWrapper = this.$widget.find('.body-wrapper');
    }

    async renderBody() {
        if (!this.isVisible()) {
            return;
        }

        const $body = this.$widget.find('.card-body');
        const revisionItems = await server.get(`notes/${this.ctx.note.noteId}/revisions`);

        if (revisionItems.length === 0) {
            $body.text("No revisions yet...");
            return;
        }

        $body.html(TPL);

        const $list = $body.find('.note-revision-list');

        for (const item of revisionItems) {
            $list.append($('<li>').append($("<a>", {
                'data-action': 'note-revision',
                'data-note-path': this.ctx.note.noteId,
                'data-note-revision-id': item.noteRevisionId,
                href: 'javascript:'
            }).text(item.dateModifiedFrom)));
        }
    }

    syncDataReceived(syncData) {
        if (syncData.find(sd => sd.entityName === 'note_revisions' && sd.noteId === this.ctx.note.noteId)) {
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

export default NoteRevisionsWidget;