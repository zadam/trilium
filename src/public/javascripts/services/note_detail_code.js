import libraryLoader from "./library_loader.js";
import bundleService from "./bundle.js";
import infoService from "./info.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";

let codeEditor = null;

const $component = $('#note-detail-code');
const $executeScriptButton = $("#execute-script-button");

async function show() {
    await libraryLoader.requireLibrary(libraryLoader.CODE_MIRROR);

    if (!codeEditor) {
        CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
        CodeMirror.keyMap.default["Tab"] = "indentMore";

        // these conflict with backward/forward navigation shortcuts
        delete CodeMirror.keyMap.default["Alt-Left"];
        delete CodeMirror.keyMap.default["Alt-Right"];

        CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

        codeEditor = CodeMirror($component[0], {
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

        onNoteChange(noteDetailService.noteChanged);
    }

    $component.show();

    const currentNote = noteDetailService.getCurrentNote();

    // this needs to happen after the element is shown, otherwise the editor won't be refreshed
    // CodeMirror breaks pretty badly on null so even though it shouldn't happen (guarded by consistency check)
    // we provide fallback
    codeEditor.setValue(currentNote.content || "");

    const info = CodeMirror.findModeByMIME(currentNote.mime);

    if (info) {
        codeEditor.setOption("mode", info.mime);
        CodeMirror.autoLoadMode(codeEditor, info.mode);
    }

    codeEditor.refresh();
}

function getContent() {
    return codeEditor.getValue();
}

function focus() {
    codeEditor.focus();
}

async function executeCurrentNote() {
    // ctrl+enter is also used elsewhere so make sure we're running only when appropriate
    if (noteDetailService.getCurrentNoteType() !== 'code') {
        return;
    }

    // make sure note is saved so we load latest changes
    await noteDetailService.saveNoteIfChanged();

    const currentNote = noteDetailService.getCurrentNote();

    if (currentNote.mime.endsWith("env=frontend")) {
        await bundleService.getAndExecuteBundle(noteDetailService.getCurrentNoteId());
    }

    if (currentNote.mime.endsWith("env=backend")) {
        await server.post('script/run/' + noteDetailService.getCurrentNoteId());
    }

    infoService.showMessage("Note executed");
}

function onNoteChange(func) {
    codeEditor.on('change', func);
}

$(document).bind('keydown', "ctrl+return", executeCurrentNote);

$executeScriptButton.click(executeCurrentNote);

export default {
    show,
    getContent,
    focus,
    onNoteChange,
    cleanup: () => {
        if (codeEditor) {
            codeEditor.setValue('');
        }
    }
}
