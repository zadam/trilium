import server from "../../services/server.js";
import CollapsibleWidget from "../collapsible_widget.js";

const TPL = `
<ul class="note-revision-list" style="max-height: 150px; overflow: auto;">
</ul>
`;

class NoteRevisionsWidget extends CollapsibleWidget {
    get widgetTitle() { return "Note revisions"; }

    get help() {
        return {
            title: "Note revisions track changes in the note across the time.",
            url: "https://github.com/zadam/trilium/wiki/Note-revisions"
        };
    }

    get headerActions() {
        const $showFullButton = $("<a>").append("show dialog").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const attributesDialog = await import("../../dialogs/note_revisions.js");
            attributesDialog.showCurrentNoteRevisions(this.noteId);
        });

        return [$showFullButton];
    }

    noteSwitched() {
        const noteId = this.noteId;

        // avoid executing this expensive operation multiple times when just going through notes (with keyboard especially)
        // until the users settles on a note
        setTimeout(() => {
            if (this.noteId === noteId) {
                this.refresh();
            }
        }, 1000);
    }

    async refreshWithNote(note) {
        const revisionItems = await server.get(`notes/${note.noteId}/revisions`);

        if (revisionItems.length === 0) {
            this.$body.text("No revisions yet...");
            return;
        }

        if (note.noteId !== this.noteId) {
            return;
        }

        this.$body.html(TPL);

        const $list = this.$body.find('.note-revision-list');

        for (const item of revisionItems) {
            const $listItem = $('<li>').append($("<a>", {
                'data-action': 'note-revision',
                'data-note-path': note.noteId,
                'data-note-revision-id': item.noteRevisionId,
                title: 'This revision was last edited on ' + item.dateLastEdited,
                href: 'javascript:'
            }).text(item.dateLastEdited.substr(0, 16)));

            if (item.contentLength !== null) {
                $listItem.append($("<span>").text(` (${item.contentLength} bytes)`))
            }

            $list.append($listItem);
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.hasNoteRevisionForNote(this.noteId)) {
            this.refresh();
        }
    }
}

export default NoteRevisionsWidget;