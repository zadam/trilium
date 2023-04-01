import BasicWidget from "../basic_widget.js";
import server from "../../services/server.js";
import dialogService from "../../services/dialog.js";

const TPL = `
<div class="dropdown attachment-actions">
    <style>
    .attachment-actions {
        width: 35px;
        height: 35px;
    }
    
    .attachment-actions .dropdown-menu {
        width: 15em;
    }
    
    .attachment-actions .dropdown-item[disabled], .attachment-actions .dropdown-item[disabled]:hover {
        color: var(--muted-text-color) !important;
        background-color: transparent !important;
        pointer-events: none; /* makes it unclickable */
    }
    </style>

    <button type="button" data-toggle="dropdown" aria-haspopup="true" 
        aria-expanded="false" class="icon-action icon-action-always-border bx bx-dots-vertical-rounded"></button>

    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-command="deleteAttachment" class="dropdown-item delete-attachment-button">Delete attachment</a>
        <a data-trigger-command="pullAttachmentIntoNote" class="dropdown-item pull-attachment-into-note-button">Pull attachment into note</a>
        <a data-trigger-command="pullAttachmentIntoNote" class="dropdown-item pull-attachment-into-note-button">Copy into clipboard</a>
    </div>
</div>`;

export default class AttachmentActionsWidget extends BasicWidget {
    constructor(attachment) {
        super();

        this.attachment = attachment;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.on('click', '.dropdown-item', () => this.$widget.find("[data-toggle='dropdown']").dropdown('toggle'));
    }

    async deleteAttachmentCommand() {
        if (await dialogService.confirm(`Are you sure you want to delete attachment '${this.attachment.title}'?`)) {
            await server.remove(`notes/${this.attachment.parentId}/attachments/${this.attachment.attachmentId}`);
        }
    }
}
