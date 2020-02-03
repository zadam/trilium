import TabAwareWidget from "./tab_aware_widget.js";

const TPL = `
<div class="dropdown note-actions">
    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
        Note actions
        <span class="caret"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-event="showNoteRevisions" class="dropdown-item show-note-revisions-button">Revisions</a>
        <a data-trigger-event="showAttributes" class="dropdown-item show-attributes-button"><kbd data-kb-action="ShowAttributes"></kbd> Attributes</a>
        <a data-trigger-event="showLinkMap" class="dropdown-item show-link-map-button"><kbd data-kb-action="ShowLinkMap"></kbd> Link map</a>
        <a data-trigger-event="showNoteSource" class="dropdown-item show-source-button"><kbd data-kb-action="ShowNoteSource"></kbd> Note source</a>
        <a class="dropdown-item import-files-button">Import files</a>
        <a class="dropdown-item export-note-button">Export note</a>
        <a data-trigger-event="printActiveNote" class="dropdown-item print-note-button"><kbd data-kb-action="PrintActiveNote"></kbd> Print note</a>
        <a data-trigger-event="showNoteInfo" class="dropdown-item show-note-info-button"><kbd data-kb-action="ShowNoteInfo"></kbd> Note info</a>
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
        this.$showSourceButton.prop('disabled', !['text', 'relation-map', 'search', 'code'].includes(note.type));
        this.$exportNoteButton.prop('disabled', note.type !== 'text');
    }

    triggerEvent(e, eventName) {
        const $item = $(e.target).closest('dropdown-item');

        if ($item.is('[disabled]')) {
            return;
        }

        this.trigger(eventName);
    }
}