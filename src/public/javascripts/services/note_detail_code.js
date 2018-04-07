import libraryLoader from "./library_loader.js";
import bundleService from "./bundle.js";
import infoService from "./info.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";

let codeEditor = null;

const $noteDetailCode = $('#note-detail-code');
const $executeScriptButton = $("#execute-script-button");

async function show() {
    await libraryLoader.requireLibrary(libraryLoader.CODE_MIRROR);

    if (!codeEditor) {
        CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
        CodeMirror.keyMap.default["Tab"] = "indentMore";

        CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

        codeEditor = CodeMirror($noteDetailCode[0], {
            value: "",
            viewportMargin: Infinity,
            indentUnit: 4,
            matchBrackets: true,
            matchTags: {bothTags: true},
            highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: false},
            lint: true,
            gutters: ["CodeMirror-lint-markers"],
            lineNumbers: true
        });

        codeEditor.on('change', noteDetailService.noteChanged);
    }

    $noteDetailCode.show();

    const currentNote = noteDetailService.getCurrentNote();

    // this needs to happen after the element is shown, otherwise the editor won't be refreshed
    codeEditor.setValue(currentNote.content);

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
    if (noteDetailService.getCurrentNoteType() === 'code') {
        // make sure note is saved so we load latest changes
        await noteDetailService.saveNoteIfChanged();

        const currentNote = noteDetailService.getCurrentNote();

        if (currentNote.mime.endsWith("env=frontend")) {
            const bundle = await server.get('script/bundle/' + noteDetailService.getCurrentNoteId());

            bundleService.executeBundle(bundle);
        }

        if (currentNote.mime.endsWith("env=backend")) {
            await server.post('script/run/' + noteDetailService.getCurrentNoteId());
        }

        infoService.showMessage("Note executed");
    }
}

$(document).bind('keydown', "ctrl+return", executeCurrentNote);

$executeScriptButton.click(executeCurrentNote);

export default {
    show,
    getContent,
    focus
}