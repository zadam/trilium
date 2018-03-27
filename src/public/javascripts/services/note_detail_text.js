import utils from "./utils.js";
import noteDetailService from './note_detail.js';

const $noteDetailText = $('#note-detail-text');

let textEditor = null;

async function showTextNote() {
    if (!textEditor) {
        await utils.requireLibrary(utils.CKEDITOR);

        textEditor = await BalloonEditor.create($noteDetailText[0], {});

        textEditor.document.on('change', noteDetailService.noteChanged);
    }

    // temporary workaround for https://github.com/ckeditor/ckeditor5-enter/issues/49
    textEditor.setData(noteDetailService.getCurrentNote().content || "<p></p>");

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
    showTextNote,
    getEditor,
    getContent,
    focus
}