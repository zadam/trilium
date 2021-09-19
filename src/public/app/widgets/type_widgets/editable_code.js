import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import keyboardActionService from "../../services/keyboard_actions.js";

const TPL = `
<div class="note-detail-code note-detail-printable">
    <style>
    .note-detail-code-editor {
        min-height: 50px;
    }
    </style>

    <div class="note-detail-code-editor"></div>

    <div style="text-align: center">    
        <button data-trigger-command="runActiveNote"
                class="no-print execute-button btn btn-sm">
            Execute <kbd data-command="runActiveNote"></kbd>
        </button>
    </div>
</div>`;

export default class EditableCodeTypeWidget extends TypeWidget {
    static getType() { return "editable-code"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$editor = this.$widget.find('.note-detail-code-editor');
        this.$executeButton = this.$widget.find('.execute-button');

        keyboardActionService.setupActionsForElement('code-detail', this.$widget, this);

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

        const noteComplement = await this.tabContext.getNoteComplement();

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
