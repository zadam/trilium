import libraryLoader from "../../services/library_loader.js";
import toastService from "../../services/toast.js";
import utils from "../../services/utils.js";
import appContext from "../../services/app_context.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="markdown-import-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Markdown import</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <p>Because of browser sandbox it's not possible to directly read clipboard from JavaScript. Please paste the Markdown to import to textarea below and click on Import button</p>

                <textarea class="markdown-import-textarea" style="height: 340px; width: 100%"></textarea>
            </div>
            <div class="modal-footer">
                <button class="markdown-import-button btn btn-primary">Import <kbd>Ctrl+Enter</kbd></button>
            </div>
        </div>
    </div>
</div>`;

export default class MarkdownImportDialog extends BasicWidget {
    constructor() {
        super();

        this.lastOpenedTs = 0;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$importTextarea = this.$widget.find('.markdown-import-textarea');
        this.$importButton = this.$widget.find('.markdown-import-button');

        this.$importButton.on('click', () => this.sendForm());

        this.$widget.on('shown.bs.modal', () => this.$importTextarea.trigger('focus'));

        utils.bindElShortcut(this.$widget, 'ctrl+return', () => this.sendForm());
    }

    async convertMarkdownToHtml(text) {
        await libraryLoader.requireLibrary(libraryLoader.COMMONMARK);

        const reader = new commonmark.Parser();
        const writer = new commonmark.HtmlRenderer();
        const parsed = reader.parse(text);

        const result = writer.render(parsed);

        const textEditor = await appContext.tabManager.getActiveContext().getTextEditor();

        const viewFragment = textEditor.data.processor.toView(result);
        const modelFragment = textEditor.data.toModel(viewFragment);

        textEditor.model.insertContent(modelFragment, textEditor.model.document.selection);

        toastService.showMessage("Markdown content has been imported into the document.");
    }

    async pasteMarkdownIntoTextEvent() {
        await this.importMarkdownInlineEvent(); // BC with keyboard shortcuts command
    }

    async importMarkdownInlineEvent() {
        if (appContext.tabManager.getActiveContextNoteType() !== 'text') {
            return;
        }

        if (utils.isElectron()) {
            const {clipboard} = utils.dynamicRequire('electron');
            const text = clipboard.readText();

            this.convertMarkdownToHtml(text);
        }
        else {
            utils.openDialog(this.$widget);
        }
    }

    async sendForm() {
        const text = this.$importTextarea.val();

        this.$widget.modal('hide');

        await this.convertMarkdownToHtml(text);

        this.$importTextarea.val('');
    }
}
