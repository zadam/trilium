import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import keyboardActionService from "../../services/keyboard_actions.js";
import server from "../../services/server.js";
import ws from "../../services/ws.js";
import appContext from "../../services/app_context.js";
import toastService from "../../services/toast.js";
import treeService from "../../services/tree.js";

const TPL = `
<div class="note-detail-code note-detail-printable">
    <style>
    .note-detail-code {
        position: relative;
    }
    
    .trilium-api-docs-button {
        /*display: none;*/
        position: absolute;
        top: 10px;
        right: 10px;
    }
    
    .note-detail-code-editor {
        min-height: 50px;
    }
    </style>
    
    <button class="btn bx bx-help-circle trilium-api-docs-button icon-button floating-button" 
            title="Open Trilium API docs"></button>

    <div class="note-detail-code-editor"></div>

    <div style="display: flex; justify-content: space-evenly;">
        <button data-trigger-command="runActiveNote"
                class="no-print execute-button btn btn-sm">
            Execute <kbd data-command="runActiveNote"></kbd>
        </button>
        
        <button class="no-print save-to-note-button btn btn-sm">
            
            <span class="bx bx-save"></span>
            Save to note</kbd>
        </button>
    </div>
</div>`;

export default class EditableCodeTypeWidget extends TypeWidget {
    static getType() { return "editable-code"; }

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

        this.$editor = this.$widget.find('.note-detail-code-editor');
        this.$executeButton = this.$widget.find('.execute-button');
        this.$saveToNoteButton = this.$widget.find('.save-to-note-button');
        this.$saveToNoteButton.on('click', async () => {
            const {notePath} = await server.post("special-notes/save-sql-console", {sqlConsoleNoteId: this.noteId});

            await ws.waitForMaxKnownEntityChangeId();

            await appContext.tabManager.getActiveContext().setNote(notePath);

            toastService.showMessage("SQL Console note has been saved into " + await treeService.getNotePathTitle(notePath));
        });

        keyboardActionService.setupActionsForElement('code-detail', this.$widget, this);

        super.doRender();

        this.initialized = this.initEditor();
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CODE_MIRROR);

        CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
        CodeMirror.keyMap.default["Tab"] = "indentMore";

        // these conflict with backward/forward navigation shortcuts
        delete CodeMirror.keyMap.default["Alt-Left"];
        delete CodeMirror.keyMap.default["Alt-Right"];

        CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

        this.codeEditor = CodeMirror(this.$editor[0], {
            value: "",
            viewportMargin: Infinity,
            indentUnit: 4,
            matchBrackets: true,
            matchTags: {bothTags: true},
            highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: false},
            lint: true,
            gutters: ["CodeMirror-lint-markers"],
            lineNumbers: true,
            tabindex: 300,
            // we linewrap partly also because without it horizontal scrollbar displays only when you scroll
            // all the way to the bottom of the note. With line wrap there's no horizontal scrollbar so no problem
            lineWrapping: true,
            dragDrop: false // with true the editor inlines dropped files which is not what we expect
        });

        this.codeEditor.on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async doRefresh(note) {
        this.$executeButton.toggle(
            note.mime.startsWith('application/javascript')
            || note.mime === 'text/x-sqlite;schema=trilium'
        );

        this.$saveToNoteButton.toggle(
            note.mime === 'text/x-sqlite;schema=trilium'
            && !note.getAllNotePaths().find(notePathArr => !notePathArr.includes("hidden"))
        );

        this.$openTriliumApiDocsButton.toggle(note.mime.startsWith('application/javascript;env='));

        const noteComplement = await this.noteContext.getNoteComplement();

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            // CodeMirror breaks pretty badly on null so even though it shouldn't happen (guarded by consistency check)
            // we provide fallback
            this.codeEditor.setValue(noteComplement.content || "");
            this.codeEditor.clearHistory();

            const info = CodeMirror.findModeByMIME(note.mime);

            if (info) {
                this.codeEditor.setOption("mode", info.mime);
                CodeMirror.autoLoadMode(this.codeEditor, info.mode);
            }
        });

        this.show();
    }

    show() {
        this.$widget.show();

        if (this.codeEditor) { // show can be called before render
            this.codeEditor.refresh();
        }
    }

    getContent() {
        return this.codeEditor.getValue();
    }

    focus() {
        this.$editor.focus();
        this.codeEditor.focus();
    }

    cleanup() {
        if (this.codeEditor) {
            this.spacedUpdate.allowUpdateWithoutChange(() => {
                this.codeEditor.setValue('');
            });
        }
    }
}
