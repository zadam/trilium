import server from "../../services/server.js";
import ws from "../../services/ws.js";
import appContext from "../../services/app_context.js";
import toastService from "../../services/toast.js";
import treeService from "../../services/tree.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import keyboardActionService from "../../services/keyboard_actions.js";

const TPL = `
<div class="editable-code-buttons-widget">
    <style>
    .editable-code-buttons-widget {
        display: flex; 
        justify-content: space-evenly;
        padding: 5px;
        height: 45px;
    }
    </style>
    
    <button data-trigger-command="runActiveNote"
            class="no-print execute-button btn btn-sm">
        <span class="bx bx-run"></span>
            
        Execute <kbd data-command="runActiveNote"></kbd>
    </button>
    
    <button class="no-print trilium-api-docs-button btn btn-sm" 
        title="Open Trilium API docs">
        <span class="bx bx-help-circle"></span>
        
        API docs
    </button>
    
    <button class="no-print save-to-note-button btn btn-sm">
        <span class="bx bx-save"></span>
        Save to note</kbd>
    </button>
</div>`;

export default class EditableCodeButtonsWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && this.note
            && (this.note.mime.startsWith('application/javascript')  || this.note.mime === 'text/x-sqlite;schema=trilium');
    }

    doRender() {
        this.$widget = $(TPL);
        this.$openTriliumApiDocsButton = this.$widget.find(".trilium-api-docs-button");
        this.$openTriliumApiDocsButton.on("click", () => {
            if (this.note.mime.endsWith("frontend")) {
                window.open("https://zadam.github.io/trilium/frontend_api/FrontendScriptApi.html", "_blank");
            }
            else {
                window.open("https://zadam.github.io/trilium/backend_api/BackendScriptApi.html", "_blank");
            }
        });

        this.$executeButton = this.$widget.find('.execute-button');
        this.$saveToNoteButton = this.$widget.find('.save-to-note-button');
        this.$saveToNoteButton.on('click', async () => {
            const {notePath} = await server.post("special-notes/save-sql-console", {sqlConsoleNoteId: this.noteId});

            await ws.waitForMaxKnownEntityChangeId();

            await appContext.tabManager.getActiveContext().setNote(notePath);

            toastService.showMessage("SQL Console note has been saved into " + await treeService.getNotePathTitle(notePath));
        });

        keyboardActionService.setupActionsForElement('code-detail', this.$widget, this);
        keyboardActionService.updateDisplayedShortcuts(this.$widget);

        super.doRender();
    }

    refreshWithNote(note) {
        this.$executeButton.toggle(
            note.mime.startsWith('application/javascript')
            || note.mime === 'text/x-sqlite;schema=trilium'
        );

        this.$saveToNoteButton.toggle(
            note.mime === 'text/x-sqlite;schema=trilium'
            && !note.getAllNotePaths().find(notePathArr => !notePathArr.includes("hidden"))
        );

        this.$openTriliumApiDocsButton.toggle(note.mime.startsWith('application/javascript;env='));
    }

    async noteTypeMimeChangedEvent({noteId}) {
        if (this.isNote(noteId)) {
            await this.refresh();
        }
    }
}
