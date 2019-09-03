import server from "../services/server.js";
import StandardWidget from "./standard_widget.js";

const TPL = `
<ul class="note-revision-list" style="max-height: 150px; overflow: auto;">
</ul>
`;

class NoteRevisionsWidget extends StandardWidget {
    getWidgetTitle() { return "Note revisions"; }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show dialog").addClass('widget-header-action');
        $showFullButton.click(async () => {
            const attributesDialog = await import("../dialogs/note_revisions.js");
            attributesDialog.showDialog();
        });

        return [$showFullButton];
    }

    async doRenderBody() {
        const revisionItems = await server.get(`notes/${this.ctx.note.noteId}/revisions`);

        if (revisionItems.length === 0) {
            this.$body.text("No revisions yet...");
            return;
        }

        this.$body.html(TPL);

        const $list = this.$body.find('.note-revision-list');

        for (const item of revisionItems) {
            $list.append($('<li>').append($("<a>", {
                'data-action': 'note-revision',
                'data-note-path': this.ctx.note.noteId,
                'data-note-revision-id': item.noteRevisionId,
                href: 'javascript:'
            }).text(item.dateModifiedFrom)));
        }
    }

    eventReceived(name, data) {
        if (name === 'syncData') {
            if (data.find(sd => sd.entityName === 'note_revisions' && sd.noteId === this.ctx.note.noteId)) {
                this.doRenderBody();
            }
        }
    }
}

export default NoteRevisionsWidget;