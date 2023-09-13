import TypeWidget from "./type_widget.js";
import AttachmentDetailWidget from "../attachment_detail.js";
import linkService from "../../services/link.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="attachment-list note-detail-printable">
    <style>
        .attachment-list {
            padding-left: 15px;
            padding-right: 15px;
        }
        
        .attachment-list .links-wrapper {
            font-size: larger;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }
    </style>
    
    <div class="links-wrapper"></div>

    <div class="attachment-list-wrapper"></div>
</div>`;

export default class AttachmentListTypeWidget extends TypeWidget {
    static getType() {
        return "attachmentList";
    }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find('.attachment-list-wrapper');
        this.$linksWrapper = this.$widget.find('.links-wrapper');

        super.doRender();
    }

    async doRefresh(note) {
        const $helpButton = $('<button class="attachment-help-button" type="button" data-help-page="attachments" title="Open help page on attachments"><span class="bx bx-help-circle"></span></button>');
        utils.initHelpButtons($helpButton);

        const noteLink = await linkService.createLink(this.noteId); // do separately to avoid race condition between empty() and .append()

        this.$linksWrapper.empty().append(
            $('<div>').append(
                "Owning note: ",
                noteLink,
            ),
            $('<div>').append(
                $('<button class="btn btn-sm">')
                    .text("Upload attachments")
                    .on('click', () => this.triggerCommand("showUploadAttachmentsDialog", {noteId: this.noteId})),
                $helpButton
            )
        );

        this.$list.empty();
        this.children = [];
        this.renderedAttachmentIds = new Set();

        const attachments = await note.getAttachments();

        if (attachments.length === 0) {
            this.$list.html('<div class="alert alert-info">This note has no attachments.</div>');

            return;
        }

        for (const attachment of attachments) {
            const attachmentDetailWidget = new AttachmentDetailWidget(attachment, false);

            this.child(attachmentDetailWidget);

            this.renderedAttachmentIds.add(attachment.attachmentId);

            this.$list.append(attachmentDetailWidget.render());
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        // updates and deletions are handled by the detail, for new attachments the whole list has to be refreshed
        const attachmentsAdded = loadResults.getAttachmentRows()
            .some(att => !this.renderedAttachmentIds.has(att.attachmentId));

        if (attachmentsAdded) {
            this.refresh();
        }
    }
}
