import libraryLoader from "./library_loader.js";
import noteDetailService from './note_detail.js';
import utils from "./utils.js";
import infoService from "./info.js";

const $noteDetailText = $('#note-detail-text');

const $markdownImportDialog = $('#markdown-import-dialog');
const $markdownImportTextarea = $('#markdown-import-textarea');
const $markdownImportButton = $('#markdown-import-button');

let textEditor = null;

async function show() {
    if (!textEditor) {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        // textEditor might have been initialized during previous await so checking again
        // looks like double initialization can freeze CKEditor pretty badly
        if (!textEditor) {
            textEditor = await BalloonEditor.create($noteDetailText[0], {
                heading: {
                    options: [
                        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
                    ]
                }
            });

            textEditor.model.document.on('change:data', noteDetailService.noteChanged);
        }
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

async function convertMarkdownToHtml(text) {
    await libraryLoader.requireLibrary(libraryLoader.COMMONMARK);

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();
    const parsed = reader.parse(text);

    const result = writer.render(parsed);

    const viewFragment = textEditor.data.processor.toView(result);
    const modelFragment = textEditor.data.toModel(viewFragment);

    textEditor.model.insertContent(modelFragment, textEditor.model.document.selection);

    infoService.showMessage("Markdown content has been imported into the document.");
}

async function importMarkdownInline() {
    if (utils.isElectron()) {
        const {clipboard} = require('electron');
        const text = clipboard.readText();

        convertMarkdownToHtml(text);
    }
    else {
        $("input[name='search-text']").focus();

        glob.activeDialog = $markdownImportDialog;

        $markdownImportDialog.dialog({
            modal: true,
            width: 700,
            height: 500
        });
    }
}

async function sendMarkdownDialog() {
    const text = $markdownImportTextarea.val();

    $markdownImportDialog.dialog('close');

    await convertMarkdownToHtml(text);

    $markdownImportTextarea.val('');
}

$markdownImportButton.click(sendMarkdownDialog);

$markdownImportDialog.bind('keydown', 'ctrl+return', sendMarkdownDialog);

window.glob.importMarkdownInline = importMarkdownInline;

export default {
    show,
    getEditor,
    getContent,
    focus
}