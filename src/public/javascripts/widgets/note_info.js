import CollapsibleWidget from "./collapsible_widget.js";

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
    </style>

    <tr>
        <th nowrap>Note ID:</th>
        <td nowrap colspan="3" class="note-info-note-id"></td>
    </tr>
    <tr>
        <th nowrap>Created:</th>
        <td nowrap colspan="3" style="overflow: hidden; text-overflow: ellipsis;" class="note-info-date-created"></td>
    </tr>
    <tr>
        <th nowrap>Modified:</th>
        <td nowrap colspan="3" style="overflow: hidden; text-overflow: ellipsis;" class="note-info-date-modified"></td>
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
    getWidgetTitle() { return "Note info"; }

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
            .text(noteComplement.dateCreated)
            .attr("title", noteComplement.dateCreated);

        this.$dateModified
            .text(noteComplement.dateModified)
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