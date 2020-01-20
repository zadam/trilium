import TabAwareWidget from "./tab_aware_widget.js";

const TPL = `
<div class="dropdown note-actions">
    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
        Note actions
        <span class="caret"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
        <a class="dropdown-item show-note-revisions-button">Revisions</a>
        <a class="dropdown-item show-attributes-button"><kbd data-kb-action="ShowAttributes"></kbd> Attributes</a>
        <a class="dropdown-item show-link-map-button"><kbd data-kb-action="ShowLinkMap"></kbd> Link map</a>
        <a class="dropdown-item show-source-button"><kbd data-kb-action="ShowNoteSource"></kbd> Note source</a>
        <a class="dropdown-item import-files-button">Import files</a>
        <a class="dropdown-item export-note-button">Export note</a>
        <a class="dropdown-item print-note-button"><kbd data-kb-action="PrintActiveNote"></kbd> Print note</a>
        <a class="dropdown-item show-note-info-button"><kbd data-kb-action="ShowNoteInfo"></kbd> Note info</a>
    </div>
</div>`;

export default class NoteActionsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$showRevisionsButton = this.$widget.find('.show-note-revisions-button');
        this.$showRevisionsButton.on('click', e => this.triggerEvent(e, 'showNoteRevisions'));

        this.$showAttributesButton = this.$widget.find('.show-attributes-button');
        this.$showAttributesButton.on('click', e => this.triggerEvent(e, 'showAttributes'));

        this.$showLinkMapButton = this.$widget.find('.show-link-map-button');
        this.$showLinkMapButton.on('click', e => this.triggerEvent(e, 'showLinkMap'));

        this.$showSourceButton = this.$widget.find('.show-source-button');
        this.$showSourceButton.on('click', e => this.triggerEvent(e, 'showSource'));

        this.$showNoteInfoButton = this.$widget.find('.show-note-info-button');
        this.$showNoteInfoButton.on('click', e => this.triggerEvent(e, 'showNoteInfo'));

        this.$exportNoteButton = this.$widget.find('.export-note-button');

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