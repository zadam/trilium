import CollapsibleWidget from "../collapsible_widget.js";
import server from "../../services/server.js";

const TPL = `
<table class="note-info-widget-table">
    <style>
        .note-info-widget-table {
            max-width: 100%;            
            display: block;
            overflow-x: auto;
            white-space: nowrap;
        } 
   
        .note-info-widget-table td, .note-info-widget-table th {
            padding: 5px;
        }
        
        .note-info-mime {
            max-width: 13em;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    </style>

    <tr>
        <th>Note ID:</th>
        <td class="note-info-note-id"></td>
        <th>Type:</th>
        <td>
            <span class="note-info-type"></span>
            
            <span class="note-info-mime"></span>
        </td>
    </tr>
    <tr>
        <th>Created:</th>
        <td class="note-info-date-created"></td>
        <th>Modified:</th>
        <td class="note-info-date-modified"></td>
    </tr>
    <tr title="Note size provides rough estimate of storage requirements for this note. It takes into account note's content and content of its note revisions.">
        <th>Note size:</th>
        
        <td colspan="3">
            <span class="note-size"></span>
            
            (subtree size: <span class="subtree-size"></span>)
        </td>
    </tr>
</table>
`;

export default class NoteInfoWidget extends CollapsibleWidget {
    isEnabled() {
        return super.isEnabled() && !this.note.hasLabel('noteInfoWidgetDisabled');
    }

    get widgetTitle() { return "Note info"; }

    async doRenderBody() {
        this.$body.html(TPL);

        this.$noteId = this.$body.find(".note-info-note-id");
        this.$dateCreated = this.$body.find(".note-info-date-created");
        this.$dateModified = this.$body.find(".note-info-date-modified");
        this.$type = this.$body.find(".note-info-type");
        this.$mime = this.$body.find(".note-info-mime");
        this.$noteSize = this.$body.find(".note-size");
        this.$subTreeSize = this.$body.find(".subtree-size");
    }

    async refreshWithNote(note) {
        const noteComplement = await this.tabContext.getNoteComplement();

        this.$noteId.text(note.noteId);
        this.$dateCreated
            .text(noteComplement.dateCreated.substr(0, 16))
            .attr("title", noteComplement.dateCreated);

        this.$dateModified
            .text(noteComplement.combinedDateModified.substr(0, 16))
            .attr("title", noteComplement.combinedDateModified);

        this.$type.text(note.type);

        if (note.mime) {
            this.$mime.text('(' + note.mime + ')');
        }
        else {
            this.$mime.empty();
        }

        const resp = await server.get(`stats/note-size/${note.noteId}`);
        this.$noteSize.text(this.formatSize(resp.noteSize));

        const $calculateLink = $('<a href="javascript:">calculate</a>')
            .on('click', async () => {
                const resp = await server.get(`stats/subtree-size/${note.noteId}`);

                this.$subTreeSize.text(this.formatSize(resp.subTreeSize));
            })

        this.$subTreeSize.empty().append($calculateLink);
    }

    formatSize(size) {
        size = Math.max(Math.round(size / 1024), 1);

        if (size < 1024) {
            return `${size} KiB`;
        }
        else {
            return `${Math.round(size / 102.4) / 10} MiB`;
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId) || loadResults.isNoteContentReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
