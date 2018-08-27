import libraryLoader from "./library_loader.js";
import noteDetailService from './note_detail.js';

const $noteDetailText = $('#note-detail-text');

let textEditor = null;

async function show() {
    if (!textEditor) {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        textEditor = await BalloonEditor.create($noteDetailText[0], {});

        textEditor.model.document.on('change:data', noteDetailService.noteChanged);
    }

    textEditor.setData(noteDetailService.getCurrentNote().content);

    $noteDetailText.show();
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
    $noteDetailText.focus();
}

function getEditor() {
    return textEditor;
}

export default {
    show,
    getEditor,
    getContent,
    focus
}