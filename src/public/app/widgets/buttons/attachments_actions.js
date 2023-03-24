import BasicWidget from "../basic_widget.js";

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

        // this.$findInTextButton = this.$widget.find('.find-in-text-button');
        // this.$printActiveNoteButton = this.$widget.find('.print-active-note-button');
        // this.$showSourceButton = this.$widget.find('.show-source-button');
        // this.$renderNoteButton = this.$widget.find('.render-note-button');
        //
        // this.$exportNoteButton = this.$widget.find('.export-note-button');
        // this.$exportNoteButton.on("click", () => {
        //     if (this.$exportNoteButton.hasClass("disabled")) {
        //         return;
        //     }
        //
        //     this.triggerCommand("showExportDialog", {
        //         notePath: this.noteContext.notePath,
        //         defaultType: "single"
        //     });
        // });
        //
        // this.$importNoteButton = this.$widget.find('.import-files-button');
        // this.$importNoteButton.on("click", () => this.triggerCommand("showImportDialog", {noteId: this.noteId}));
        //
        // this.$widget.on('click', '.dropdown-item', () => this.$widget.find("[data-toggle='dropdown']").dropdown('toggle'));
        //
        // this.$openNoteExternallyButton = this.$widget.find(".open-note-externally-button");
        //
        // this.$deleteNoteButton = this.$widget.find(".delete-note-button");
        // this.$deleteNoteButton.on("click", () => {
        //     if (this.note.noteId === 'root') {
        //         return;
        //     }
        //
        //     branchService.deleteNotes([this.note.getParentBranches()[0].branchId], true);
        // });
    }

    refreshWithNote(note) {
        // this.toggleDisabled(this.$findInTextButton, ['text', 'code', 'book', 'search'].includes(note.type));
        //
        // this.toggleDisabled(this.$showSourceButton, ['text', 'relationMap', 'mermaid'].includes(note.type));
        //
        // this.toggleDisabled(this.$printActiveNoteButton, ['text', 'code'].includes(note.type));
        //
        // this.$renderNoteButton.toggle(note.type === 'render');
        //
        // this.$openNoteExternallyButton.toggle(utils.isElectron());
    }

    toggleDisabled($el, enable) {
        if (enable) {
            $el.removeAttr('disabled');
        } else {
            $el.attr('disabled', 'disabled');
        }
    }
}
