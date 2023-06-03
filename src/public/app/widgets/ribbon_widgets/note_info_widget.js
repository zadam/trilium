import NoteContextAwareWidget from "../note_context_aware_widget.js";
import server from "../../services/server.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="note-info-widget">
    <style>
        .note-info-widget {
            padding: 12px;
        }
        
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

    <table class="note-info-widget-table">
        <tr>
            <th>Note ID:</th>
            <td class="note-info-note-id"></td>
            <th>Created:</th>
            <td class="note-info-date-created"></td>
            <th>Modified:</th>
            <td class="note-info-date-modified"></td>
        </tr>
        <tr>
            <th>Type:</th>
            <td>
                <span class="note-info-type"></span>
                
                <span class="note-info-mime"></span>
            </td>

            <th title="Note size provides rough estimate of storage requirements for this note. It takes into account note's content and content of its note revisions.">Note size:</th>
           
            <td colspan="3">
                <button class="btn btn-sm calculate-button" style="padding: 0px 10px 0px 10px;">
                    <span class="bx bx-calculator"></span> calculate
                </button>
                
                <span class="note-sizes-wrapper">
                    <span class="note-size"></span>
                    
                    <span class="subtree-size"></span>
                </span>
            </td>
        </tr>
    </table>
</div>
`;
export default class NoteInfoWidget extends NoteContextAwareWidget {
    get name() {
        return "noteInfo";
    }

    get toggleCommand() {
        return "toggleRibbonTabNoteInfo";
    }

    isEnabled() {
        return this.note;
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            title: 'Note Info',
            icon: 'bx bx-info-circle'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$noteId = this.$widget.find(".note-info-note-id");
        this.$dateCreated = this.$widget.find(".note-info-date-created");
        this.$dateModified = this.$widget.find(".note-info-date-modified");
        this.$type = this.$widget.find(".note-info-type");
        this.$mime = this.$widget.find(".note-info-mime");

        this.$noteSizesWrapper = this.$widget.find('.note-sizes-wrapper');
        this.$noteSize = this.$widget.find(".note-size");
        this.$subTreeSize = this.$widget.find(".subtree-size");

        this.$calculateButton = this.$widget.find(".calculate-button");
        this.$calculateButton.on('click', async () => {
            this.$noteSizesWrapper.show();
            this.$calculateButton.hide();

            this.$noteSize.empty().append($('<span class="bx bx-loader bx-spin"></span>'));
            this.$subTreeSize.empty().append($('<span class="bx bx-loader bx-spin"></span>'));

            const noteSizeResp = await server.get(`stats/note-size/${this.noteId}`);
            this.$noteSize.text(utils.formatNoteSize(noteSizeResp.noteSize));

            const subTreeResp = await server.get(`stats/subtree-size/${this.noteId}`);

            if (subTreeResp.subTreeNoteCount > 1) {
                this.$subTreeSize.text(`(subtree size: ${utils.formatNoteSize(subTreeResp.subTreeSize)} in ${subTreeResp.subTreeNoteCount} notes)`);
            }
            else {
                this.$subTreeSize.text("");
            }
        });
    }

    async refreshWithNote(note) {
        const noteComplement = await this.noteContext.getNoteComplement();

        this.$noteId.text(note.noteId);
        this.$dateCreated
            .text(noteComplement.dateCreated.substr(0, 16))
            .attr("title", noteComplement.dateCreated);

        this.$dateModified
            .text(noteComplement.combinedDateModified.substr(0, 16))
            .attr("title", noteComplement.combinedDateModified);

        this.$type.text(note.type);

        if (note.mime) {
            this.$mime.text(`(${note.mime})`);
        }
        else {
            this.$mime.empty();
        }

        this.$calculateButton.show();
        this.$noteSizesWrapper.hide();
    }
    
    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId) || loadResults.isNoteContentReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
