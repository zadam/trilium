import NoteContextAwareWidget from "../note_context_aware_widget.js";
import keyboardActionService from "../../services/keyboard_actions.js";

const TPL = `
<div class="script-runner-widget">
    <style>
        .script-runner-widget {
            padding: 12px;
            color: var(--muted-text-color);
        }

        .execute-description {
            margin-bottom: 10px;
        }
    </style>

    <div class="execute-description"></div>
    
    <div style="display: flex; justify-content: space-around">
        <button data-trigger-command="runActiveNote" class="execute-button btn btn-sm"></button>
    </div>
</div>`;

export default class ScriptExecutorWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && this.note
            && (this.note.mime.startsWith('application/javascript') || this.isTriliumSqlite())
            && (this.note.hasLabel('executeDescription') || this.note.hasLabel('executeButton'));
    }

    isTriliumSqlite() {
        return this.note.mime === 'text/x-sqlite;schema=trilium';
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            activate: true,
            title: this.isTriliumSqlite() ? 'Query' : 'Script',
            icon: 'bx bx-run'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$executeButton = this.$widget.find('.execute-button');
        this.$executeDescription = this.$widget.find('.execute-description');
    }

    async refreshWithNote(note) {
        const executeTitle = note.getLabelValue('executeButton')
            || (this.isTriliumSqlite() ? 'Execute Query' : 'Execute Script');

        this.$executeButton.text(executeTitle);
        this.$executeButton.attr('title', executeTitle);
        keyboardActionService.updateDisplayedShortcuts(this.$widget);

        const executeDescription = note.getLabelValue('executeDescription');

        if (executeDescription) {
            this.$executeDescription.show().html(executeDescription);
        } else {
            this.$executeDescription.empty().hide();
        }
    }
}
