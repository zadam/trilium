import BasicWidget from "../basic_widget.js";
import server from "../../services/server.js";
import dialogService from "../../services/dialog.js";
import toastService from "../../services/toast.js";
import ws from "../../services/ws.js";
import appContext from "../../components/app_context.js";

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
        aria-expanded="false" class="icon-action icon-action-always-border bx bx-dots-vertical-rounded"></button>

    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-command="deleteAttachment" class="dropdown-item">Delete attachment</a>
        <a data-trigger-command="convertAttachmentIntoNote" class="dropdown-item">Convert attachment into note</a>
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
        if (!await dialogService.confirm(`Are you sure you want to delete attachment '${this.attachment.title}'?`)) {
            return;
        }

        await server.remove(`attachments/${this.attachment.attachmentId}`);
        toastService.showMessage(`Attachment '${this.attachment.title}' has been deleted.`);
    }

    async convertAttachmentIntoNoteCommand() {
        if (!await dialogService.confirm(`Are you sure you want to convert attachment '${this.attachment.title}' into a separate note?`)) {
            return;
        }

        const {note: newNote} = await server.post(`attachments/${this.attachment.attachmentId}/convert-to-note`)
        toastService.showMessage(`Attachment '${this.attachment.title}' has been converted to note.`);
        await ws.waitForMaxKnownEntityChangeId();
        await appContext.tabManager.getActiveContext().setNote(newNote.noteId);
    }
}
