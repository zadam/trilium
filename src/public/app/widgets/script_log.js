import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="script-log-widget">
    <style>
    .script-log-widget {
        padding: 15px;
    }
    </style>
   
    <div class="script-log-container"></div>
</div>`;

export default class ScriptLogWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note
            && this.note.mime.startsWith('application/javascript;env=')
            && super.isEnabled();
    }

    doRender() {
        this.$widget = $(TPL);

        this.$logContainer = this.$widget.find('.script-log-container');
    }
}
