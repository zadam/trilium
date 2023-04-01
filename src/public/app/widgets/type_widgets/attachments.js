import TypeWidget from "./type_widget.js";
import server from "../../services/server.js";
import utils from "../../services/utils.js";
import AttachmentActionsWidget from "../buttons/attachments_actions.js";
import AttachmentDetailWidget from "../attachment_detail.js";

const TPL = `
<div class="attachments note-detail-printable">
    <style>
        .attachments {
            padding: 15px;
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
            const attachmentDetailWidget = new AttachmentDetailWidget(attachment);
            this.child(attachmentDetailWidget);

            this.$list.append(attachmentDetailWidget.render());
        }
    }
}
