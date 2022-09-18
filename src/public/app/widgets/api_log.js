import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="api-log-widget">
    <style>
    .api-log-widget {
        padding: 15px;
        flex-grow: 1;
        max-height: 40%;
        position: relative;
    }
    
    .hidden-api-log {
        display: none;
    }
    
    .api-log-container {
        overflow: auto;
        height: 100%;
    }
    
    .close-api-log-button {
        padding: 5px;
        border: 1px solid var(--button-border-color);
        background-color: var(--button-background-color);
        border-radius: var(--button-border-radius);
        color: var(--button-text-color);
        position: absolute;
        top: 10px;
        right: 40px;
        cursor: pointer;
    }
    </style>
    
    <div class="bx bx-x close-api-log-button" title="Close"></div>
   
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
        this.toggle(false);

        this.$logContainer = this.$widget.find('.api-log-container');
        this.$closeButton = this.$widget.find(".close-api-log-button");
        this.$closeButton.on("click", () => this.toggle(false));
    }

    async refreshWithNote(note) {
        this.$logContainer.empty();
    }

    apiLogMessagesEvent({messages, noteId}) {
        if (!this.isNote(noteId)) {
            return;
        }

        this.toggle(true);

        for (const message of messages) {
            this.$logContainer.append(message).append($("<br>"));
        }
    }

    toggle(show) {
        this.$widget.toggleClass("hidden-api-log", !show);
    }
}
