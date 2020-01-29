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

    async refreshWithNote() {
        const note = this.tabContext.note;
        const revisionItems = await server.get(`notes/${note.noteId}/revisions`);

        if (revisionItems.length === 0) {
            this.$body.text("No revisions yet...");
            return;
        }

        this.$body.html(TPL);

        const $list = this.$body.find('.note-revision-list');

        for (const item of revisionItems) {
            const $listItem = $('<li>').append($("<a>", {
                'data-action': 'note-revision',
                'data-note-path': note.noteId,
                'data-note-revision-id': item.noteRevisionId,
                href: 'javascript:'
            }).text(item.dateLastEdited.substr(0, 16)));

            if (item.contentLength !== null) {
                $listItem.append($("<span>").text(` (${item.contentLength} bytes)`))
            }

            $list.append($listItem);
        }
    }

    entitiesReloadedListener({loadResults}) {
        if (loadResults.hasNoteRevisionForNote(this.noteId)) {
            this.refresh();
        }
    }

    syncDataListener({data}) {
        if (data.find(sd => sd.entityName === 'note_revisions' && sd.noteId === this.tabContext.note.noteId)) {
            this.refresh();
        }
    }
}

export default NoteRevisionsWidget;