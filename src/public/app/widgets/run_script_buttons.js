import TabAwareWidget from "./tab_aware_widget.js";

const TPL = `
<div style="display: inline-flex;">
    <button class="btn btn-sm icon-button bx bx-play-circle render-button"
            data-trigger-command="renderActiveNote"
            title="Render"></button>
    
    <button class="btn btn-sm icon-button bx bx-play-circle execute-script-button"
            data-trigger-command="runActiveNote"
            title="Execute"></button>
</div>`;

export default class RunScriptButtonsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$renderButton = this.$widget.find('.render-button');
        this.$executeScriptButton = this.$widget.find('.execute-script-button');

        return this.$widget;
    }

    refreshWithNote(note) {
        this.$renderButton.toggle(note.type === 'render');
        this.$executeScriptButton.toggle(note.type === 'code' && note.mime.startsWith('application/javascript'));
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}