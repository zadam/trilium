import TypeWidget from "./type_widget.js";
import server from "../../services/server.js";
import AttachmentDetailWidget from "../attachment_detail.js";

const TPL = `
<div class="attachment-detail note-detail-printable">
    <style>
        .attachment-detail {
            padding: 15px;
        }
    </style>

    <div class="attachment-wrapper"></div>
</div>`;

export default class AttachmentDetailTypeWidget extends TypeWidget {
    static getType() {
        return "attachmentDetail";
    }

    doRender() {
        this.$widget = $(TPL);
        this.$wrapper = this.$widget.find('.attachment-wrapper');

        super.doRender();
    }

    async doRefresh(note) {
        this.$wrapper.empty();
        this.children = [];
        this.renderedAttachmentIds = new Set();

        const attachment = await server.get(`attachments/${this.noteContext.viewScope.attachmentId}/?includeContent=true`);

        if (!attachment) {
            this.$wrapper.html("<strong>This attachment has been deleted.</strong>");

            return;
        }

        const attachmentDetailWidget = new AttachmentDetailWidget(attachment);
        attachmentDetailWidget.isFullDetail = true;
        this.child(attachmentDetailWidget);

        this.$wrapper.append(attachmentDetailWidget.render());
    }

    async entitiesReloadedEvent({loadResults}) {
        const attachmentChange = loadResults.getAttachments().find(att => att.attachmentId === this.attachment.attachmentId);

        if (attachmentChange?.isDeleted) {
            this.refresh(); // all other updates are handled within AttachmentDetailWidget
        }
    }
}
