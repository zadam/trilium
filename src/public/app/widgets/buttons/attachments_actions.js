import BasicWidget from "../basic_widget.js";
import server from "../../services/server.js";
import dialogService from "../../services/dialog.js";
import toastService from "../../services/toast.js";
import ws from "../../services/ws.js";
import appContext from "../../components/app_context.js";
import openService from "../../services/open.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="dropdown attachment-actions">
    <style>
    .attachment-actions {
        width: 35px;
        height: 35px;
    }
    
    .attachment-actions .dropdown-menu {
        width: 20em;
    }
    
    .attachment-actions .dropdown-item[disabled], .attachment-actions .dropdown-item[disabled]:hover {
        color: var(--muted-text-color) !important;
        background-color: transparent !important;
        pointer-events: none; /* makes it unclickable */
    }
    </style>

    <button type="button" data-toggle="dropdown" aria-haspopup="true" 
        aria-expanded="false" class="icon-action icon-action-always-border bx bx-dots-vertical-rounded"
        style="position: relative; top: 3px;"></button>

    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-command="openAttachment" class="dropdown-item"
            title="File will be open in an external application and watched for changes. You'll then be able to upload the modified version back to Trilium.">Open externally</a>
        <a data-trigger-command="openAttachmentCustom" class="dropdown-item"
            title="File will be open in an external application and watched for changes. You'll then be able to upload the modified version back to Trilium.">Open custom</a>
        <a data-trigger-command="downloadAttachment" class="dropdown-item">Download</a>
        <a data-trigger-command="renameAttachment" class="dropdown-item">Rename attachment</a>
        <a data-trigger-command="uploadNewAttachmentRevision" class="dropdown-item">Upload new revision</a>
        <a data-trigger-command="copyAttachmentLinkToClipboard" class="dropdown-item">Copy link to clipboard</a>
        <a data-trigger-command="convertAttachmentIntoNote" class="dropdown-item">Convert attachment into note</a>
        <a data-trigger-command="deleteAttachment" class="dropdown-item">Delete attachment</a>
    </div>
    
    <input type="file" class="attachment-upload-new-revision-input" style="display: none">
</div>`;

export default class AttachmentActionsWidget extends BasicWidget {
    constructor(attachment, isFullDetail) {
        super();

        this.attachment = attachment;
        this.isFullDetail = isFullDetail;
    }

    get attachmentId() {
        return this.attachment.attachmentId;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.on('click', '.dropdown-item', () => this.$widget.find("[data-toggle='dropdown']").dropdown('toggle'));

        this.$uploadNewRevisionInput = this.$widget.find(".attachment-upload-new-revision-input");
        this.$uploadNewRevisionInput.on('change', async () => {
            const fileToUpload = this.$uploadNewRevisionInput[0].files[0]; // copy to allow reset below
            this.$uploadNewRevisionInput.val('');

            const result = await server.upload(`attachments/${this.attachmentId}/file`, fileToUpload);

            if (result.uploaded) {
                toastService.showMessage("New attachment revision has been uploaded.");
            } else {
                toastService.showError("Upload of a new attachment revision failed.");
            }
        });

        if (!this.isFullDetail) {
            // we deactivate this button because the WatchedFileUpdateStatusWidget assumes only one visible attachment
            // in a note context, so it doesn't work in a list
            const $openAttachmentButton = this.$widget.find("[data-trigger-command='openAttachment']");
            $openAttachmentButton
                .addClass("disabled")
                .append($('<span class="disabled-tooltip"> (?)</span>')
                    .attr("title", "Opening attachment externally is available only from the detail page, please first click on the attachment detail first and repeat the action.")
                );
            const $openAttachmentCustomButton = this.$widget.find("[data-trigger-command='openAttachmentCustom']");
            $openAttachmentCustomButton
                .addClass("disabled")
                .append($('<span class="disabled-tooltip"> (?)</span>')
                    .attr("title", "Opening attachment externally is available only from the detail page, please first click on the attachment detail first and repeat the action.")
                );
        }
        if (!utils.isElectron()){
            const $openAttachmentCustomButton = this.$widget.find("[data-trigger-command='openAttachmentCustom']");
            $openAttachmentCustomButton
                .addClass("disabled")
                .append($('<span class="disabled-tooltip"> (?)</span>')
                    .attr("title", "Custom opening of attachments can only be done from the client.")
                );
        }
    }

    async openAttachmentCommand() {
        await openService.openAttachmentExternally(this.attachmentId, this.attachment.mime);
    }

    async openAttachmentCustomCommand() {
        await openService.openAttachmentCustom(this.attachmentId, this.attachment.mime);
    }

    async downloadAttachmentCommand() {
        await openService.downloadAttachment(this.attachmentId);
    }

    async uploadNewAttachmentRevisionCommand() {
        this.$uploadNewRevisionInput.trigger('click');
    }

    async copyAttachmentLinkToClipboardCommand() {
        this.parent.copyAttachmentLinkToClipboard();
    }

    async deleteAttachmentCommand() {
        if (!await dialogService.confirm(`Are you sure you want to delete attachment '${this.attachment.title}'?`)) {
            return;
        }

        await server.remove(`attachments/${this.attachmentId}`);
        toastService.showMessage(`Attachment '${this.attachment.title}' has been deleted.`);
    }

    async convertAttachmentIntoNoteCommand() {
        if (!await dialogService.confirm(`Are you sure you want to convert attachment '${this.attachment.title}' into a separate note?`)) {
            return;
        }

        const {note: newNote} = await server.post(`attachments/${this.attachmentId}/convert-to-note`)
        toastService.showMessage(`Attachment '${this.attachment.title}' has been converted to note.`);
        await ws.waitForMaxKnownEntityChangeId();
        await appContext.tabManager.getActiveContext().setNote(newNote.noteId);
    }

    async renameAttachmentCommand() {
        const attachmentTitle = await dialogService.prompt({
            title: "Rename attachment",
            message: "Please enter new attachment's name",
            defaultValue: this.attachment.title
        });

        if (!attachmentTitle?.trim()) {
            return;
        }

        await server.put(`attachments/${this.attachmentId}/rename`, {title: attachmentTitle});
    }
}
