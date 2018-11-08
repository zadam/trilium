import libraryLoader from "./library_loader.js";
import noteDetailService from './note_detail.js';

const $component = $('#note-detail-text');

let textEditor = null;

async function show() {
    if (!textEditor) {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        // textEditor might have been initialized during previous await so checking again
        // looks like double initialization can freeze CKEditor pretty badly
        if (!textEditor) {
            textEditor = await BalloonEditor.create($component[0]);

            onNoteChange(noteDetailService.noteChanged);
        }
    }

    textEditor.setData(noteDetailService.getCurrentNote().content);

    $component.show();
}

function getContent() {
    let content = textEditor.getData();

    // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
    // this is important when setting new note to code
    if (jQuery(content).text().trim() === '' && !content.includes("<img")) {
        content = '';
    }

    return content;
}

function focus() {
    $component.focus();
}

function getEditor() {
    return textEditor;
}

function onNoteChange(func) {
    textEditor.model.document.on('change:data', func);
}

export default {
    show,
    getEditor,
    getContent,
    focus,
    onNoteChange,
    cleanup: () => {
        if (textEditor) {
            textEditor.setData('');
        }
    }
}