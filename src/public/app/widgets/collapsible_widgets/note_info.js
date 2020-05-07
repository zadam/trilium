import CollapsibleWidget from "../collapsible_widget.js";

const TPL = `
<table class="note-info-widget-table">
    <style>
        .note-info-widget-table {
            table-layout: fixed; 
            width: 100%;
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
        <td colspan="3" class="note-info-note-id"></td>
    </tr>
    <tr>
        <th>Created:</th>
        <td colspan="3" class="note-info-date-created"></td>
    </tr>
    <tr>
        <th>Modified:</th>
        <td colspan="3" class="note-info-date-modified"></td>
    </tr>
    <tr>
        <th>Type:</th>
        <td class="note-info-type"></td>
        
        <th>MIME:</th>
        <td class="note-info-mime"></td>
    </tr>
</table>
`;

export default class NoteInfoWidget extends CollapsibleWidget {
    get widgetTitle() { return "Note info"; }

    async doRenderBody() {
        this.$body.html(TPL);

        this.$noteId = this.$body.find(".note-info-note-id");
        this.$dateCreated = this.$body.find(".note-info-date-created");
        this.$dateModified = this.$body.find(".note-info-date-modified");
        this.$type = this.$body.find(".note-info-type");
        this.$mime = this.$body.find(".note-info-mime");
    }

    async refreshWithNote(note) {
        const noteComplement = await this.tabContext.getNoteComplement();

        this.$noteId.text(note.noteId);
        this.$dateCreated
            .text(noteComplement.dateCreated.substr(0, 16))
            .attr("title", noteComplement.dateCreated);

        this.$dateModified
            .text(noteComplement.dateModified.substr(0, 16))
            .attr("title", noteComplement.dateCreated);

        this.$type.text(note.type);

        this.$mime
            .text(note.mime)
            .attr("title", note.mime);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
