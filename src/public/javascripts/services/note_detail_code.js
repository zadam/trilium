import libraryLoader from "./library_loader.js";
import bundleService from "./bundle.js";
import infoService from "./info.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";
import utils from "./utils.js";

class NoteDetailCode {

    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.codeEditor = null;
        this.$component = ctx.$tabContent.find('.note-detail-code');
        this.$editorEl = this.$component.find('.note-detail-code-editor');
        this.$executeScriptButton = ctx.$tabContent.find(".execute-script-button");

        utils.bindElShortcut(ctx.$tabContent, "ctrl+return", () => this.executeCurrentNote());

        this.$executeScriptButton.click(() => this.executeCurrentNote());
    }

    async render() {
        await libraryLoader.requireLibrary(libraryLoader.CODE_MIRROR);

        if (!this.codeEditor) {
            CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
            CodeMirror.keyMap.default["Tab"] = "indentMore";

            // these conflict with backward/forward navigation shortcuts
            delete CodeMirror.keyMap.default["Alt-Left"];
            delete CodeMirror.keyMap.default["Alt-Right"];

            CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

            this.codeEditor = CodeMirror(this.$editorEl[0], {
                value: "",
                viewportMargin: Infinity,
                indentUnit: 4,
                matchBrackets: true,
                matchTags: {bothTags: true},
                highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: false},
                lint: true,
                gutters: ["CodeMirror-lint-markers"],
                lineNumbers: true,
                tabindex: 100,
                // we linewrap partly also because without it horizontal scrollbar displays only when you scroll
                // all the way to the bottom of the note. With line wrap there's no horizontal scrollbar so no problem
                lineWrapping: true
            });

            this.onNoteChange(() => this.ctx.noteChanged());
        }

        this.$component.show();

        // this needs to happen after the element is shown, otherwise the editor won't be refreshed
        // CodeMirror breaks pretty badly on null so even though it shouldn't happen (guarded by consistency check)
        // we provide fallback
        this.codeEditor.setValue(this.ctx.note.content || "");

        const info = CodeMirror.findModeByMIME(this.ctx.note.mime);

        if (info) {
            this.codeEditor.setOption("mode", info.mime);
            CodeMirror.autoLoadMode(this.codeEditor, info.mode);
        }

        this.codeEditor.refresh();
    }

    getContent() {
        return this.codeEditor.getValue();
    }

    focus() {
        this.codeEditor.focus();
    }

    async executeCurrentNote() {
        // ctrl+enter is also used elsewhere so make sure we're running only when appropriate
        if (this.ctx.note.type !== 'code') {
            return;
        }

        // make sure note is saved so we load latest changes
        await noteDetailService.saveNotesIfChanged();

        if (this.ctx.note.mime.endsWith("env=frontend")) {
            await bundleService.getAndExecuteBundle(this.ctx.note.noteId);
        }

        if (this.ctx.note.mime.endsWith("env=backend")) {
            await server.post('script/run/' + this.ctx.note.noteId);
        }

        infoService.showMessage("Note executed");
    }

    onNoteChange(func) {
        this.codeEditor.on('change', func);
    }

    cleanup() {
        if (this.codeEditor) {
            this.codeEditor.setValue('');
        }
    }

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailCode;