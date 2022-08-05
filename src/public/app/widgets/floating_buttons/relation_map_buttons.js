import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
<div>
    <button type="button"
            class="relation-map-create-child-note floating-button btn bx bx-folder-plus no-print"
            title="Create new child note and add it into this relation map"></button>
    
    <button type="button"
            class="relation-map-reset-pan-zoom floating-button btn bx bx-crop no-print"
            title="Reset pan & zoom to initial coordinates and magnification"></button>
    
    <div class="btn-group no-print">
        <button type="button"
                class="relation-map-zoom-in floating-button btn bx bx-zoom-in"
                title="Zoom In"></button>
    
        <button type="button"
                class="relation-map-zoom-out floating-button btn bx bx-zoom-out"
                title="Zoom Out"></button>
    </div>
</div>`;

export default class RelationMapButtons extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled() && this.note?.type === 'relation-map';
    }

    doRender() {
        super.doRender();

        this.$widget = $(TPL);
        this.$createChildNote = this.$widget.find(".relation-map-create-child-note");
        this.$zoomInButton = this.$widget.find(".relation-map-zoom-in");
        this.$zoomOutButton = this.$widget.find(".relation-map-zoom-out");
        this.$resetPanZoomButton = this.$widget.find(".relation-map-reset-pan-zoom");

        this.$createChildNote.on('click', () => this.triggerEvent('relationMapCreateChildNote', {ntxId: this.ntxId}));
        this.$resetPanZoomButton.on('click', () => this.triggerEvent('relationMapResetPanZoom', {ntxId: this.ntxId}));

        this.$zoomInButton.on('click', () => this.triggerEvent('relationMapResetZoomIn', {ntxId: this.ntxId}));
        this.$zoomOutButton.on('click', () => this.triggerEvent('relationMapResetZoomOut', {ntxId: this.ntxId}));
        this.contentSized();
    }
}
