import TypeWidget from "./type_widget.js";
import server from "../../services/server.js";
import utils from "../../services/utils.js";
import AttachmentActionsWidget from "../buttons/attachments_actions.js";

const TPL = `
<div class="attachments note-detail-printable">
    <style>
        .attachments {
            padding: 15px;
        }
        
        .attachment-wrapper {
            margin-bottom: 20px;
        }
        
        .attachment-title-line {
            display: flex;
            align-items: baseline;
        }
        
        .attachment-details {
            margin-left: 10px;
        }
        
        .attachment-content pre {
            max-height: 400px;
            background: var(--accented-background-color);
            padding: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .attachment-content img {
            margin: 10px;
            max-height: 300px; 
            max-width: 90%; 
            object-fit: contain;
        }
    </style>

    <div class="attachment-list"></div>
</div>`;

export default class AttachmentsTypeWidget extends TypeWidget {
    static getType() { return "attachments"; }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find('.attachment-list');

        super.doRender();
    }

    async doRefresh(note) {
        this.$list.empty();
        this.children = [];

        const attachments = await server.get(`notes/${this.noteId}/attachments?includeContent=true`);

        if (attachments.length === 0) {
            this.$list.html("<strong>This note has no attachments.</strong>");

            return;
        }

        for (const attachment of attachments) {
            const attachmentActionsWidget = new AttachmentActionsWidget();
            this.child(attachmentActionsWidget);

            this.$list.append(
                $('<div class="attachment-wrapper">')
                    .append(
                        $('<div class="attachment-title-line">')
                            .append($('<h4>').append($('<span class="attachment-title">').text(attachment.title)))
                            .append(
                                $('<div class="attachment-details">')
                                    .text(`Role: ${attachment.role}, Size: ${utils.formatSize(attachment.contentLength)}`)
                            )
                            .append($('<div style="flex: 1 1;">')) // spacer
                            .append(attachmentActionsWidget.render())
                    )
                    .append(
                        $('<div class="attachment-content">')
                            .append(this.renderContent(attachment))
                    )
            );
        }
    }

    renderContent(attachment) {
        if (attachment.content) {
            return $("<pre>").text(attachment.content);
        } else if (attachment.role === 'image') {
            return `<img src="api/notes/${attachment.parentId}/images/${attachment.attachmentId}/${encodeURIComponent(attachment.title)}?${attachment.utcDateModified}">`;
        } else {
            return '';
        }
    }
}