import TabAwareWidget from "./tab_aware_widget.js";

const TPL = `
<div class="dropdown note-actions">
    <style>
    .note-actions .dropdown-menu {
        width: 15em;
    }
    
    .note-actions .dropdown-item[disabled], .note-actions .dropdown-item[disabled]:hover {
        color: var(--muted-text-color) !important;
        background-color: transparent !important;
    }
    </style>

    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
        Note actions
        <span class="caret"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-command="showNoteRevisions" class="dropdown-item show-note-revisions-button">Revisions</a>
        <a data-trigger-command="showAttributes" class="dropdown-item show-attributes-button"><kbd data-command="showAttributes"></kbd> Attributes</a>
        <a data-trigger-command="showLinkMap" class="dropdown-item show-link-map-button"><kbd data-command="showLinkMap"></kbd> Link map</a>
        <a data-trigger-command="showNoteSource" class="dropdown-item show-source-button"><kbd data-command="showNoteSource"></kbd> Note source</a>
        <a class="dropdown-item import-files-button">Import files</a>
        <a class="dropdown-item export-note-button">Export note</a>
        <a data-trigger-command="printActiveNote" class="dropdown-item print-note-button"><kbd data-command="printActiveNote"></kbd> Print note</a>
        <a data-trigger-command="showNoteInfo" class="dropdown-item show-note-info-button"><kbd data-command="showNoteInfo"></kbd> Note info</a>
    </div>
</div>`;

export default class NoteActionsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$showSourceButton = this.$widget.find('.show-source-button');

        this.$exportNoteButton = this.$widget.find('.export-note-button');
        this.$exportNoteButton.on("click", () => {
            if (this.$exportNoteButton.hasClass("disabled")) {
                return;
            }

            import('../dialogs/export.js').then(d => d.showDialog(this.tabContext.notePath, 'single'));
        });

        this.$importNoteButton = this.$widget.find('.import-files-button');
        this.$importNoteButton.on("click", () => import('../dialogs/import.js').then(d => d.showDialog(this.noteId)));

        return this.$widget;
    }

    refreshWithNote(note) {
        if (['text', 'relation-map', 'search', 'code'].includes(note.type)) {
            this.$showSourceButton.removeAttr('disabled');
        } else {
            this.$showSourceButton.attr('disabled', 'disabled');
        }

        if (note.type === 'text') {
            this.$exportNoteButton.removeAttr('disabled');
        }
        else {
            this.$exportNoteButton.attr('disabled', 'disabled');
        }
    }

    triggerEvent(e, eventName) {
        const $item = $(e.target).closest('dropdown-item');

        if ($item.is('[disabled]')) {
            return;
        }

        this.triggerEvent(eventName);
    }
}