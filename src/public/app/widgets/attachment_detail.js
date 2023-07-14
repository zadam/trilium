import utils from "../services/utils.js";
import AttachmentActionsWidget from "./buttons/attachments_actions.js";
import BasicWidget from "./basic_widget.js";
import options from "../services/options.js";
import imageService from "../services/image.js";
import linkService from "../services/link.js";
import contentRenderer from "../services/content_renderer.js";
import toastService from "../services/toast.js";

const TPL = `
<div class="attachment-detail-widget">
    <style>
        .attachment-detail-widget {
            height: 100%;
        }
    
        .attachment-detail-wrapper {
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
        }
        
        .attachment-title-line {
            display: flex;
            align-items: baseline;
            gap: 1em;
        }
        
        .attachment-details {
            margin-left: 10px;
        }
        
        .attachment-content-wrapper {
            flex-grow: 1;
        }
        
        .attachment-content-wrapper .rendered-content {
            height: 100%;
        }
        
        .attachment-content-wrapper pre {
            background: var(--accented-background-color);
            padding: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .attachment-detail-wrapper.list-view .attachment-content-wrapper {
            max-height: 300px;
        }

        .attachment-detail-wrapper.full-detail {
            height: 100%;
        }

        .attachment-detail-wrapper.full-detail .attachment-content-wrapper {
            height: 100%;
        }
        
        .attachment-detail-wrapper.list-view .attachment-content-wrapper pre {
            max-height: 400px;
        }
        
        .attachment-content-wrapper img {
            margin: 10px;
        }
        
        .attachment-detail-wrapper.list-view .attachment-content-wrapper img, .attachment-detail-wrapper.list-view .attachment-content-wrapper video {
            max-height: 300px; 
            max-width: 90%; 
            object-fit: contain;
        }
        
        .attachment-detail-wrapper.full-detail .attachment-content-wrapper img {
            max-width: 90%; 
            object-fit: contain;
        }
        
        .attachment-detail-wrapper.scheduled-for-deletion .attachment-content-wrapper img {
            filter: contrast(10%);
        }
    </style>

    <div class="attachment-detail-wrapper">
        <div class="attachment-title-line">
            <div class="attachment-actions-container"></div>
            <h4 class="attachment-title"></h4>                
            <div class="attachment-details"></div>
            <div style="flex: 1 1;"></div>
        </div>
        
        <div class="attachment-deletion-warning alert alert-info" style="margin-top: 15px;"></div>
        
        <div class="attachment-content-wrapper"></div>
    </div>
</div>`;

export default class AttachmentDetailWidget extends BasicWidget {
    constructor(attachment, isFullDetail) {
        super();

        this.contentSized();
        this.attachment = attachment;
        this.attachmentActionsWidget = new AttachmentActionsWidget(attachment, isFullDetail);
        this.isFullDetail = isFullDetail;
        this.child(this.attachmentActionsWidget);
    }

    doRender() {
        this.$widget = $(TPL);
        this.refresh();

        super.doRender();
    }

    async refresh() {
        this.$widget.find('.attachment-detail-wrapper')
            .empty()
            .append(
                $(TPL)
                    .find('.attachment-detail-wrapper')
                    .html()
            );
        this.$wrapper = this.$widget.find('.attachment-detail-wrapper');
        this.$wrapper.addClass(this.isFullDetail ? "full-detail" : "list-view");

        if (!this.isFullDetail) {
            this.$wrapper.find('.attachment-title').append(
                await linkService.createLink(this.attachment.ownerId, {
                    title: this.attachment.title,
                    viewScope: {
                        viewMode: 'attachments',
                        attachmentId: this.attachment.attachmentId
                    }
                })
            );
        } else {
            this.$wrapper.find('.attachment-title')
                .text(this.attachment.title);
        }

        const $deletionWarning = this.$wrapper.find('.attachment-deletion-warning');
        const {utcDateScheduledForErasureSince} = this.attachment;

        if (utcDateScheduledForErasureSince) {
            this.$wrapper.addClass("scheduled-for-deletion");

            const scheduledSinceTimestamp = utils.parseDate(utcDateScheduledForErasureSince)?.getTime();
            const intervalMs = options.getInt('eraseUnusedAttachmentsAfterSeconds') * 1000;
            const deletionTimestamp = scheduledSinceTimestamp + intervalMs;
            const willBeDeletedInMs = deletionTimestamp - Date.now();

            $deletionWarning.show();

            if (willBeDeletedInMs >= 60000) {
                $deletionWarning.text(`This attachment will be automatically deleted in ${utils.formatTimeInterval(willBeDeletedInMs)}`);
            } else {
                $deletionWarning.text(`This attachment will be automatically deleted soon`);
            }

            $deletionWarning.append(", because the attachment is not linked in the note's content. To prevent deletion, add the attachment link back into the content or convert the attachment into note.");
        } else {
            this.$wrapper.removeClass("scheduled-for-deletion");
            $deletionWarning.hide();
        }

        this.$wrapper.find('.attachment-details')
            .text(`Role: ${this.attachment.role}, Size: ${utils.formatSize(this.attachment.contentLength)}`);
        this.$wrapper.find('.attachment-actions-container').append(this.attachmentActionsWidget.render());

        const {$renderedContent} = await contentRenderer.getRenderedContent(this.attachment, { imageHasZoom: this.isFullDetail });
        this.$wrapper.find('.attachment-content-wrapper').append($renderedContent);
    }

    async copyAttachmentLinkToClipboard() {
        if (this.attachment.role === 'image') {
            imageService.copyImageReferenceToClipboard(this.$wrapper.find('.attachment-content-wrapper'));
        } else if (this.attachment.role === 'file') {
            const $link = await linkService.createLink(this.attachment.ownerId, {
                referenceLink: true,
                viewScope: {
                    viewMode: 'attachments',
                    attachmentId: this.attachment.attachmentId
                }
            });

            utils.copyHtmlToClipboard($link[0].outerHTML);

            toastService.showMessage("Attachment link copied to clipboard.");
        } else {
            throw new Error(`Unrecognized attachment role '${this.attachment.role}'.`);
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        const attachmentRow = loadResults.getAttachmentRows().find(att => att.attachmentId === this.attachment.attachmentId);

        if (attachmentRow) {
            if (attachmentRow.isDeleted) {
                this.toggleInt(false);
            } else {
                this.refresh();
            }
        }
    }
}
