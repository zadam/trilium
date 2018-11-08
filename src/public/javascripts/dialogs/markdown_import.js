import libraryLoader from "../services/library_loader.js";
import infoService from "../services/info.js";
import utils from "../services/utils.js";
import noteDetailTextService from "../services/note_detail_text.js";

const $markdownImportDialog = $('#markdown-import-dialog');
const $markdownImportTextarea = $('#markdown-import-textarea');
const $markdownImportButton = $('#markdown-import-button');

async function convertMarkdownToHtml(text) {
    await libraryLoader.requireLibrary(libraryLoader.COMMONMARK);

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();
    const parsed = reader.parse(text);

    const result = writer.render(parsed);

    const textEditor = noteDetailTextService.getEditor();
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

        $markdownImportDialog.modal();
    }
}

async function sendForm() {
    const text = $markdownImportTextarea.val();

    $markdownImportDialog.modal('hide');

    await convertMarkdownToHtml(text);

    $markdownImportTextarea.val('');
}

$markdownImportButton.click(sendForm);

$markdownImportDialog.bind('keydown', 'ctrl+return', sendForm);

// for CKEditor integration (button on block toolbar)
window.glob.importMarkdownInline = importMarkdownInline;

export default {
    importMarkdownInline
};