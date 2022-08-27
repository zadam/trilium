import NoteContextAwareWidget from "../note_context_aware_widget.js";
import utils from "../../services/utils.js";

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
        <a data-trigger-command="renderActiveNote" class="dropdown-item render-note-button"><kbd data-command="renderActiveNote"></kbd> Re-render note</a>
        <a data-trigger-command="findInText" class="dropdown-item find-in-text-button">Search in note <kbd data-command="findInText"></a>
        <a data-trigger-command="openNoteSourceDialog" class="dropdown-item show-source-button"><kbd data-command="showNoteSource"></kbd> Note source</a>
        <a data-trigger-command="openNoteExternally" class="dropdown-item open-note-externally-button"><kbd data-command="openNoteExternally"></kbd> Open note externally</a>
        <a class="dropdown-item import-files-button">Import files</a>
        <a class="dropdown-item export-note-button">Export note</a>
        <a data-trigger-command="printActiveNote" class="dropdown-item print-active-note-button"><kbd data-command="printActiveNote"></kbd> Print note</a>
    </div>
</div>`;

export default class NoteActionsWidget extends NoteContextAwareWidget {
    isEnabled() {
        return true;
    }

    doRender() {
        this.$widget = $(TPL);

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
    }

    refreshWithNote(note) {
        this.toggleDisabled(this.$findInTextButton, ['text', 'code', 'book', 'search'].includes(note.type));

        this.toggleDisabled(this.$showSourceButton, ['text', 'relation-map', 'search', 'code'].includes(note.type));

        this.toggleDisabled(this.$printActiveNoteButton, ['text', 'code'].includes(note.type));

        this.$renderNoteButton.toggle(note.type === 'render');

        this.$openNoteExternallyButton.toggle(utils.isElectron());
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
