import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import froca from "../../services/froca.js";

const TPL = `<div>
    <style>
    .note-detail-code-editor {
        min-height: 50px;
    }

    .spacer {
        height: 20px;
    }
    </style>

    <div class="mermaid-error alert alert-warning">
        <p><strong>The diagram could not displayed.</strong></p>
        <p class="error-content">Rendering diagram...</p>
    </div>

    <div class="mermaid-render"></div>

    <div class="spacer"></div>

    <div class="note-detail-code note-detail-printable">
        <div class="note-detail-code-editor"></div>
    </div>
</div>`;

export default class MermaidTypeWidget extends TypeWidget {
    static getType() { return "mermaid"; }

    doRender() {
        this.$widget = $(TPL);
        this.$display = this.$widget.find('.mermaid-render');

        this.$editor = this.$widget.find('.note-detail-code-editor');

        this.$errorContainer = this.$widget.find(".mermaid-error");
        this.$errorMessage = this.$errorContainer.find(".error-content");

        this.initialized = Promise.all( [this.initRenderer(), this.initEditor()]);

        super.doRender();
    }

    async initRenderer() {
        await libraryLoader.requireLibrary(libraryLoader.MERMAID);

        const documentStyle = window.getComputedStyle(document.documentElement);
        const mermaidTheme = documentStyle.getPropertyValue('--mermaid-theme');

        mermaid.mermaidAPI.initialize({ startOnLoad: false, theme: mermaidTheme.trim() });
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

        this.codeEditor.on('change', () => {
            this.spacedUpdate.scheduleUpdate();

            this.updateRender(this.codeEditor.getValue() || "");
        });
    }

    async doRefresh(note) {
        const noteComplement = await froca.getNoteComplement(note.noteId);

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            this.updateRender(noteComplement.content || "");

            this.codeEditor.setValue(noteComplement.content || "");
            this.codeEditor.clearHistory();
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

    async updateRender(graph) {
        const updateWithContent = (content) => {
            this.$display.html(content);
        }

        this.$display.empty();

        this.$errorMessage.text('Rendering diagram...');

        try {
            mermaid.mermaidAPI.render('graphDiv', graph, updateWithContent);

            this.$errorContainer.hide();
        } catch (e) {
            this.$errorMessage.text(e.message);
            this.$errorContainer.show();
        }
    }
}