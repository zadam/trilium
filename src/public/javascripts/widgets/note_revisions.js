import server from "../services/server.js";
import StandardWidget from "./standard_widget.js";

const TPL = `
<ul class="note-revision-list" style="max-height: 150px; overflow: auto;">
</ul>
`;

class NoteRevisionsWidget extends StandardWidget {
    getWidgetTitle() { return "Note revisions"; }

    getHelp() {
        return {
            title: "Note revisions track changes in the note across the time.",
            url: "https://github.com/zadam/trilium/wiki/Note-revisions"
        };
    }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show dialog").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const attributesDialog = await import("../dialogs/note_revisions.js");
            attributesDialog.showCurrentNoteRevisions(this.ctx.note.noteId);
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
            const $listItem = $('<li>').append($("<a>", {
                'data-action': 'note-revision',
                'data-note-path': this.ctx.note.noteId,
                'data-note-revision-id': item.noteRevisionId,
                href: 'javascript:'
            }).text(item.dateLastEdited.substr(0, 16)));

            if (item.contentLength !== null) {
                $listItem.append($("<span>").text(` (${item.contentLength} bytes)`))
            }

            $list.append($listItem);
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