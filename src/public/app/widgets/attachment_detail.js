import utils from "../../services/utils.js";
import AttachmentActionsWidget from "../buttons/attachments_actions.js";
import BasicWidget from "./basic_widget.js";

const TPL = `
<div class="attachment-detail">
    <style>
        .attachment-detail-wrapper {
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

    <div class="attachment-detail-wrapper">
        <div class="attachment-title-line">
            <h4 class="attachment-title"></h4>                
            <div class="attachment-details"></div>
            <div style="flex: 1 1;">
            <div class="attachment-actions-container"></div>
        </div>
        
        <div class="attachment-content"></div>
    </div>
</div>`;

export default class AttachmentDetailWidget extends BasicWidget {
    constructor(attachment) {
        super();

        this.attachment = attachment;
        this.attachmentActionsWidget = new AttachmentActionsWidget(attachment);
        this.child(this.attachmentActionsWidget);
    }

    doRender() {
        this.$widget = $(TPL);
        this.$wrapper = this.$widget.find('.attachment-detail-wrapper');
        this.$wrapper.find('.attachment-title').text(this.attachment.title);
        this.$wrapper.find('.attachment-details')
            .text(`Role: ${this.attachment.role}, Size: ${utils.formatSize(this.attachment.contentLength)}`);
        this.$wrapper.find('.attachment-actions-container').append(this.attachmentActionsWidget.render());
        this.$wrapper.find('.attachment-content').append(this.renderContent());

        super.doRender();
    }

    renderContent() {
        if (this.attachment.content) {
            return $("<pre>").text(this.attachment.content);
        } else if (this.attachment.role === 'image') {
            return `<img src="api/notes/${this.attachment.parentId}/images/${this.attachment.attachmentId}/${encodeURIComponent(this.attachment.title)}?${this.attachment.utcDateModified}">`;
        } else {
            return '';
        }
    }
}
