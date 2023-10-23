import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import keyboardActionService from "../../services/keyboard_actions.js";
import options from "../../services/options.js";

const TPL = `
<div class="note-detail-code note-detail-printable">
    <style>
    .note-detail-code {
        position: relative;
        height: 100%;
    }
    
    .note-detail-code-editor {
        min-height: 50px;
        height: 100%;
    }
    </style>

    <div class="note-detail-code-editor"></div>
</div>`;

export default class EditableCodeTypeWidget extends TypeWidget {
    static getType() { return "editableCode"; }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.note-detail-code-editor');

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

        CodeMirror.modeURL = `${window.glob.assetPath}/libraries/codemirror/mode/%N/%N.js`;

        this.codeEditor = CodeMirror(this.$editor[0], {
            value: "",
            viewportMargin: Infinity,
            indentUnit: 4,
            matchBrackets: true,
            keyMap: options.is('vimKeymapEnabled') ? "vim": "default",
            matchTags: {bothTags: true},
            highlightSelectionMatches: {showToken: false, annotateScrollbar: false},
            lint: true,
            gutters: ["CodeMirror-lint-markers"],
            lineNumbers: true,
            tabindex: 300,
            // we line wrap partly also because without it horizontal scrollbar displays only when you scroll
            // all the way to the bottom of the note. With line wrap, there's no horizontal scrollbar so no problem
            lineWrapping: options.is('codeLineWrapEnabled'),
            dragDrop: false, // with true the editor inlines dropped files which is not what we expect
            placeholder: "Type the content of your code note here...",
        });

        this.codeEditor.on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async doRefresh(note) {
        const blob = await this.note.getBlob();

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            // CodeMirror breaks pretty badly on null, so even though it shouldn't happen (guarded by a consistency check)
            // we provide fallback
            this.codeEditor.setValue(blob.content || "");
            this.codeEditor.clearHistory();

            let info = CodeMirror.findModeByMIME(note.mime);
            if (!info) {
                // Switch back to plain text if CodeMirror does not have a mode for whatever MIME type we're editing.
                // To avoid inheriting a mode from a previously open code note.
                info = CodeMirror.findModeByMIME("text/plain");
            }

            this.codeEditor.setOption("mode", info.mime);
            CodeMirror.autoLoadMode(this.codeEditor, info.mode);
        });

        this.show();
    }

    show() {
        this.$widget.show();

        if (this.codeEditor) { // show can be called before render
            this.codeEditor.refresh();
        }
    }

    getData() {
        return {
            content: this.codeEditor.getValue()
        };
    }

    focus() {
        this.$editor.focus();
        this.codeEditor.focus();
    }

    scrollToEnd() {
        this.codeEditor.setCursor(this.codeEditor.lineCount(), 0);
        this.codeEditor.focus();
    }

    cleanup() {
        if (this.codeEditor) {
            this.spacedUpdate.allowUpdateWithoutChange(() => {
                this.codeEditor.setValue('');
            });
        }
    }

    async executeWithCodeEditorEvent({resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        resolve(this.codeEditor);
    }
}
