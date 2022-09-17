import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="api-log-widget">
    <style>
    .api-log-widget {
        padding: 15px;
        flex-grow: 1;
        max-height: 40%;
    }
    
    .hidden-api-log {
        display: none;
    }
    
    .api-log-container {
        overflow: auto;
        height: 100%;
    }
    </style>
   
    <div class="api-log-container"></div>
</div>`;

export default class ApiLogWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note
            && this.note.mime.startsWith('application/javascript;env=')
            && super.isEnabled();
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.addClass("hidden-api-log");

        this.$logContainer = this.$widget.find('.api-log-container');
    }

    async refreshWithNote(note) {
        this.$logContainer.empty();
    }

    apiLogMessagesEvent({messages, noteId}) {
        if (!this.isNote(noteId)) {
            return;
        }

        this.$widget.removeClass("hidden-api-log");

        for (const message of messages) {
            this.$logContainer.append(message).append($("<br>"));
        }
    }
}
