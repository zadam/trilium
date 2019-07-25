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
        this.$title = this.$widget.find('.widget-title');
        this.$title.text("Note revisions");
    }

    async renderBody() {
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
}

export default NoteRevisionsWidget;