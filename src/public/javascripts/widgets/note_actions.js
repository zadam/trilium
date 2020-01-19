import BasicWidget from "./basic_widget.js";

const TPL = `
<div class="dropdown note-actions">
    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
        Note actions
        <span class="caret"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
        <a class="dropdown-item show-note-revisions-button" data-bind="css: { disabled: type() == 'file' || type() == 'image' }">Revisions</a>
        <a class="dropdown-item show-attributes-button"><kbd data-kb-action="ShowAttributes"></kbd> Attributes</a>
        <a class="dropdown-item show-link-map-button"><kbd data-kb-action="ShowLinkMap"></kbd> Link map</a>
        <a class="dropdown-item show-source-button" data-bind="css: { disabled: type() != 'text' && type() != 'code' && type() != 'relation-map' && type() != 'search' }">
            <kbd data-kb-action="ShowNoteSource"></kbd>
            Note source
        </a>
        <a class="dropdown-item import-files-button">Import files</a>
        <a class="dropdown-item export-note-button" data-bind="css: { disabled: type() != 'text' }">Export note</a>
        <a class="dropdown-item print-note-button"><kbd data-kb-action="PrintActiveNote"></kbd> Print note</a>
        <a class="dropdown-item show-note-info-button"><kbd data-kb-action="ShowNoteInfo"></kbd> Note info</a>
    </div>
</div>`;

export default class NoteActionsWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }
}