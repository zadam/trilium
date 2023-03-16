import TypeWidget from "./type_widget.js";
import server from "../../services/server.js";

const TPL = `
<div class="note-attachments note-detail-printable">
    <style>
        .note-attachments {
            padding: 15px;
        }
        
        .attachment-content {
            max-height: 400px;
            background: var(--accented-background-color);
            padding: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .attachment-details th {
            padding-left: 10px;
            padding-right: 10px;
        }
    </style>

    <div class="alert alert-info" style="margin: 10px 0 10px 0; padding: 20px;">
        Note attachments are pieces of data attached to a given note, providing attachment support. 
        This view is useful for diagnostics.
    </div>
    
    <div class="note-attachment-list"></div>
</div>`;

export default class AttachmentsTypeWidget extends TypeWidget {
    static getType() { return "attachments"; }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find('.note-attachment-list');

        super.doRender();
    }

    async doRefresh(note) {
        this.$list.empty();

        const attachments = await server.get(`notes/${this.noteId}/attachments?includeContent=true`);

        if (attachments.length === 0) {
            this.$list.html("<strong>This note has no attachments.</strong>");

            return;
        }

        for (const attachment of attachments) {
            this.$list.append(
                $('<div class="note-attachment-wrapper">')
                    .append(
                        $('<h4>').append($('<span class="attachment-name">').text(attachment.name))
                    )
                    .append(
                        $('<table class="attachment-details">')
                            .append(
                                $('<tr>')
                                    .append($('<th>').text('Length:'))
                                    .append($('<td>').text(attachment.contentLength))
                                    .append($('<th>').text('MIME:'))
                                    .append($('<td>').text(attachment.mime))
                                    .append($('<th>').text('Date modified:'))
                                    .append($('<td>').text(attachment.utcDateModified))
                            )
                    )
                    .append(
                        $('<pre class="attachment-content">')
                            .text(attachment.content)
                    )
            );
        }
    }
}