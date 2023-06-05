import TypeWidget from "./type_widget.js";
import AttachmentDetailWidget from "../attachment_detail.js";
import linkService from "../../services/link.js";
import froca from "../../services/froca.js";

const TPL = `
<div class="attachment-detail note-detail-printable">
    <style>
        .attachment-detail {
            padding: 15px;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .attachment-detail .links-wrapper {
            padding: 16px;
            font-size: larger;
        }
        
        .attachment-detail .attachment-wrapper {
            flex-grow: 1;
        }
    </style>

    <div class="links-wrapper"></div>

    <div class="attachment-wrapper"></div>
</div>`;

export default class AttachmentDetailTypeWidget extends TypeWidget {
    static getType() {
        return "attachmentDetail";
    }

    doRender() {
        this.$widget = $(TPL);
        this.$wrapper = this.$widget.find('.attachment-wrapper');
        this.$linksWrapper = this.$widget.find('.links-wrapper');

        super.doRender();
    }

    async doRefresh(note) {
        this.$wrapper.empty();
        this.children = [];

        this.$linksWrapper.empty().append(
            "Owning note: ",
            await linkService.createLink(this.noteId),
            ", you can also open the ",
            await linkService.createLink(this.noteId, {
                title: 'List of all attachments',
                viewScope: {
                    viewMode: 'attachments'
                }
            })
        );

        const attachment = await froca.getAttachment(this.attachmentId);

        if (!attachment) {
            this.$wrapper.html("<strong>This attachment has been deleted.</strong>");

            return;
        }

        const attachmentDetailWidget = new AttachmentDetailWidget(attachment, true);
        this.child(attachmentDetailWidget);

        this.$wrapper.append(attachmentDetailWidget.render());
    }

    async entitiesReloadedEvent({loadResults}) {
        const attachmentChange = loadResults.getAttachmentRows().find(att => att.attachmentId === this.attachmentId);

        if (attachmentChange?.isDeleted) {
            this.refresh(); // all other updates are handled within AttachmentDetailWidget
        }
    }

    get attachmentId() {
        return this.noteContext.viewScope.attachmentId;
    }
}
