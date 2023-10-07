import NoteContextAwareWidget from "../note_context_aware_widget.js";
import utils from "../../services/utils.js";
import branchService from "../../services/branches.js";
import dialogService from "../../services/dialog.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";
import ws from "../../services/ws.js";
import appContext from "../../components/app_context.js";

const TPL = `
<div class="dropdown note-actions">
    <style>
    .note-actions {
        width: 35px;
        height: 35px;
    }  
    
    .note-actions .dropdown-menu {
        width: 15em;
    }
    
    .note-actions .dropdown-item[disabled], .note-actions .dropdown-item[disabled]:hover {
        color: var(--muted-text-color) !important;
        background-color: transparent !important;
        pointer-events: none; /* makes it unclickable */
    }
    </style>

    <button type="button" data-toggle="dropdown" aria-haspopup="true" 
        aria-expanded="false" class="icon-action bx bx-dots-vertical-rounded"></button>

    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-command="convertNoteIntoAttachment" class="dropdown-item">Convert into attachment</a>
        <a data-trigger-command="renderActiveNote" class="dropdown-item render-note-button"><kbd data-command="renderActiveNote"></kbd> Re-render note</a>
        <a data-trigger-command="findInText" class="dropdown-item find-in-text-button">Search in note <kbd data-command="findInText"></a>
        <a data-trigger-command="showNoteSource" class="dropdown-item show-source-button"><kbd data-command="showNoteSource"></kbd> Note source</a>
        <a data-trigger-command="showAttachments" class="dropdown-item"><kbd data-command="showAttachments"></kbd> Note attachments</a>
        <a data-trigger-command="openNoteExternally" class="dropdown-item open-note-externally-button"
           title="File will be open in an external application and watched for changes. You'll then be able to upload the modified version back to Trilium.">
            <kbd data-command="openNoteExternally"></kbd> 
            Open note externally
        </a>
        <a data-trigger-command="openNoteCustom" class="dropdown-item open-note-custom-button"><kbd data-command="openNoteCustom"></kbd> Open note custom</a>
        <a class="dropdown-item import-files-button">Import files</a>
        <a class="dropdown-item export-note-button">Export note</a>
        <a class="dropdown-item delete-note-button">Delete note</a>
        <a data-trigger-command="printActiveNote" class="dropdown-item print-active-note-button"><kbd data-command="printActiveNote"></kbd> Print note</a>
        <a data-trigger-command="forceSaveRevision" class="dropdown-item save-revision-button"><kbd data-command="forceSaveRevision"></kbd> Save revision</a>
    </div>
</div>`;

export default class NoteActionsWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note?.type !== 'launcher';
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.on('show.bs.dropdown', () => this.refreshVisibility(this.note));

        this.$convertNoteIntoAttachmentButton = this.$widget.find("[data-trigger-command='convertNoteIntoAttachment']");
        this.$findInTextButton = this.$widget.find('.find-in-text-button');
        this.$printActiveNoteButton = this.$widget.find('.print-active-note-button');
        this.$showSourceButton = this.$widget.find('.show-source-button');
        this.$renderNoteButton = this.$widget.find('.render-note-button');

        this.$exportNoteButton = this.$widget.find('.export-note-button');
        this.$exportNoteButton.on("click", () => {
            if (this.$exportNoteButton.hasClass("disabled")) {
                return;
            }

            this.triggerCommand("showExportDialog", {
                notePath: this.noteContext.notePath,
                defaultType: "single"
            });
        });

        this.$importNoteButton = this.$widget.find('.import-files-button');
        this.$importNoteButton.on("click", () => this.triggerCommand("showImportDialog", {noteId: this.noteId}));

        this.$widget.on('click', '.dropdown-item', () => this.$widget.find("[data-toggle='dropdown']").dropdown('toggle'));

        this.$openNoteExternallyButton = this.$widget.find(".open-note-externally-button");
        this.$openNoteCustomButton = this.$widget.find(".open-note-custom-button");

        this.$deleteNoteButton = this.$widget.find(".delete-note-button");
        this.$deleteNoteButton.on("click", () => {
            if (this.note.noteId === 'root') {
                return;
            }

            branchService.deleteNotes([this.note.getParentBranches()[0].branchId], true);
        });
    }

    async refreshVisibility(note) {
        this.$convertNoteIntoAttachmentButton.toggle(note.isEligibleForConversionToAttachment());

        this.toggleDisabled(this.$findInTextButton, ['text', 'code', 'book'].includes(note.type));

        this.toggleDisabled(this.$showSourceButton, ['text', 'code', 'relationMap', 'mermaid', 'canvas'].includes(note.type));

        this.toggleDisabled(this.$printActiveNoteButton, ['text', 'code'].includes(note.type));

        this.$renderNoteButton.toggle(note.type === 'render');

        this.toggleDisabled(this.$openNoteExternallyButton, utils.isElectron() && !['search', 'book'].includes(note.type));
        this.toggleDisabled(this.$openNoteCustomButton,
            utils.isElectron()
            && !utils.isMac() // no implementation for Mac yet
            && !['search', 'book'].includes(note.type)
        );

        // I don't want to handle all special notes like this, but intuitively user might want to export content of backend log
        this.toggleDisabled(this.$exportNoteButton, !['_backendLog'].includes(note.noteId));

        this.toggleDisabled(this.$importNoteButton, !['search'].includes(note.type));
    }

    async convertNoteIntoAttachmentCommand() {
        if (!await dialogService.confirm(`Are you sure you want to convert note '${this.note.title}' into an attachment of the parent note?`)) {
            return;
        }

        const {attachment: newAttachment} = await server.post(`notes/${this.noteId}/convert-to-attachment`);

        if (!newAttachment) {
            toastService.showMessage(`Converting note '${this.note.title}' failed.`);
            return;
        }

        toastService.showMessage(`Note '${newAttachment.title}' has been converted to attachment.`);
        await ws.waitForMaxKnownEntityChangeId();
        await appContext.tabManager.getActiveContext().setNote(newAttachment.ownerId, {
            viewScope: {
                viewMode: 'attachments',
                attachmentId: newAttachment.attachmentId
            }
        });
    }

    toggleDisabled($el, enable) {
        if (enable) {
            $el.removeAttr('disabled');
        } else {
            $el.attr('disabled', 'disabled');
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
