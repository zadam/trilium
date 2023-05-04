import TypeWidget from "./type_widget.js";
import server from "../../services/server.js";
import AttachmentDetailWidget from "../attachment_detail.js";

const TPL = `
<div class="attachment-list note-detail-printable">
    <style>
        .attachment-list {
            padding: 15px;
        }
    </style>

    <div class="attachment-list-wrapper"></div>
</div>`;

export default class AttachmentListTypeWidget extends TypeWidget {
    static getType() {
        return "attachmentList";
    }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find('.attachment-list-wrapper');

        super.doRender();
    }

    async doRefresh(note) {
        this.$list.empty();
        this.children = [];
        this.renderedAttachmentIds = new Set();

        const attachments = await server.get(`notes/${this.noteId}/attachments?includeContent=true`);

        if (attachments.length === 0) {
            this.$list.html('<div class="alert alert-info">This note has no attachments.</div>');

            return;
        }

        for (const attachment of attachments) {
            const attachmentDetailWidget = new AttachmentDetailWidget(attachment);
            attachmentDetailWidget.isFullDetail = false;

            this.child(attachmentDetailWidget);

            this.renderedAttachmentIds.add(attachment.attachmentId);

            this.$list.append(attachmentDetailWidget.render());
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        // updates and deletions are handled by the detail, for new attachments the whole list has to be refreshed
        const attachmentsAdded = loadResults.getAttachments()
            .find(att => this.renderedAttachmentIds.has(att.attachmentId));

        if (attachmentsAdded) {
            this.refresh();
        }
    }
}
