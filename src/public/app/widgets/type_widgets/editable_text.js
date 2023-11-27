import libraryLoader from "../../services/library_loader.js";
import noteAutocompleteService from '../../services/note_autocomplete.js';
import mimeTypesService from '../../services/mime_types.js';
import utils from "../../services/utils.js";
import keyboardActionService from "../../services/keyboard_actions.js";
import froca from "../../services/froca.js";
import noteCreateService from "../../services/note_create.js";
import AbstractTextTypeWidget from "./abstract_text_type_widget.js";
import link from "../../services/link.js";
import appContext from "../../components/app_context.js";
import dialogService from "../../services/dialog.js";

const ENABLE_INSPECTOR = false;

const mentionSetup = {
    feeds: [
        {
            marker: '@',
            feed: queryText => noteAutocompleteService.autocompleteSourceForCKEditor(queryText),
            itemRenderer: item => {
                const itemElement = document.createElement('button');

                itemElement.innerHTML = `${item.highlightedNotePathTitle} `;

                return itemElement;
            },
            minimumCharacters: 0
        }
    ]
};

const TPL = `
<div class="note-detail-editable-text note-detail-printable">
    <style>
    .note-detail-editable-text {
        font-family: var(--detail-font-family);
        padding-left: 14px;
        padding-top: 10px;
        height: 100%;
    }
    
    body.mobile .note-detail-editable-text {
        padding-left: 4px;
    }
    
    .note-detail-editable-text a:hover {
        cursor: pointer;
    }
    
    .note-detail-editable-text a[href^="http://"], .note-detail-editable-text a[href^="https://"] {
        cursor: text !important;
    }
    
    .note-detail-editable-text *:not(figure,.include-note):first-child {
        margin-top: 0 !important;
    }
         
    .note-detail-editable-text h2 { font-size: 1.6em; } 
    .note-detail-editable-text h3 { font-size: 1.4em; }
    .note-detail-editable-text h4 { font-size: 1.2em; }
    .note-detail-editable-text h5 { font-size: 1.1em; }
    .note-detail-editable-text h6 { font-size: 1.0em; }
    
    body.heading-style-markdown .note-detail-editable-text h2::before { content: "##\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-editable-text h3::before { content: "###\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-editable-text h4:not(.include-note-title)::before { content: "####\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-editable-text h5::before { content: "#####\\2004"; color: var(--muted-text-color); }
    body.heading-style-markdown .note-detail-editable-text h6::before { content: "######\\2004"; color: var(--muted-text-color); }
    
    body.heading-style-underline .note-detail-editable-text h2 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-editable-text h3 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-editable-text h4:not(.include-note-title) { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-editable-text h5 { border-bottom: 1px solid var(--main-border-color); }
    body.heading-style-underline .note-detail-editable-text h6 { border-bottom: 1px solid var(--main-border-color); }
    
    .note-detail-editable-text-editor {
        padding-top: 10px;
        border: 0 !important;
        box-shadow: none !important;
        min-height: 50px;
        height: 100%;
    }
    </style>

    <div class="note-detail-editable-text-editor" tabindex="300"></div>
</div>
`;

export default class EditableTextTypeWidget extends AbstractTextTypeWidget {
    static getType() { return "editableText"; }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.note-detail-editable-text-editor');

        this.initialized = this.initEditor();

        keyboardActionService.setupActionsForElement('text-detail', this.$widget, this);

        this.setupImageOpening(false);

        super.doRender();
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        const codeBlockLanguages =
            (await mimeTypesService.getMimeTypes())
                .filter(mt => mt.enabled)
                .map(mt => ({
                        language: mt.mime.toLowerCase().replace(/[\W_]+/g,"-"),
                        label: mt.title
                    }));

        // CKEditor since version 12 needs the element to be visible before initialization. At the same time,
        // we want to avoid flicker - i.e., show editor only once everything is ready. That's why we have separate
        // display of $widget in both branches.
        this.$widget.show();

        this.watchdog = new EditorWatchdog(BalloonEditor, {
            // An average number of milliseconds between the last editor errors (defaults to 5000).
            // When the period of time between errors is lower than that and the crashNumberLimit
            // is also reached, the watchdog changes its state to crashedPermanently, and it stops
            // restarting the editor. This prevents an infinite restart loop.
            minimumNonErrorTimePeriod: 5000,
            // A threshold specifying the number of errors (defaults to 3).
            // After this limit is reached and the time between last errors
            // is shorter than minimumNonErrorTimePeriod, the watchdog changes
            // its state to crashedPermanently, and it stops restarting the editor.
            // This prevents an infinite restart loop.
            crashNumberLimit: 3,
            // A minimum number of milliseconds between saving the editor data internally (defaults to 5000).
            // Note that for large documents, this might impact the editor performance.
            saveInterval: 5000
        });

        this.watchdog.on('stateChange', () => {
            const currentState = this.watchdog.state;

            if (!['crashed', 'crashedPermanently'].includes(currentState)) {
                return;
            }

            console.log(`CKEditor changed to ${currentState}`);

            this.watchdog.crashes.forEach(crashInfo => console.log(crashInfo));

            if (currentState === 'crashedPermanently') {
                dialogService.info(`Editing component keeps crashing. Please try restarting Trilium. If problem persists, consider creating a bug report.`);

                this.watchdog.editor.enableReadOnlyMode('crashed-editor');
            }
        });

        this.watchdog.setCreator(async (elementOrData, editorConfig) => {
            const editor = await BalloonEditor.create(elementOrData, editorConfig);

            editor.model.document.on('change:data', () => this.spacedUpdate.scheduleUpdate());

            if (glob.isDev && ENABLE_INSPECTOR) {
                await import(/* webpackIgnore: true */'../../../libraries/ckeditor/inspector.js');
                CKEditorInspector.attach(editor);
            }

            return editor;
        });

        await this.watchdog.create(this.$editor[0], {
            placeholder: "Type the content of your note here ...",
            mention: mentionSetup,
            codeBlock: {
                languages: codeBlockLanguages
            },
            math: {
                engine: 'katex',
                outputType: 'span', // or script
                lazyLoad: async () => await libraryLoader.requireLibrary(libraryLoader.KATEX),
                forceOutputType: false, // forces output to use outputType
                enablePreview: true // Enable preview view
            }
        });
    }

    async doRefresh(note) {
        const blob = await note.getBlob();

        await this.spacedUpdate.allowUpdateWithoutChange(() =>
            this.watchdog.editor.setData(blob.content || ""));
    }

    getData() {
        const content = this.watchdog.editor.getData();

        // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty,
        // this is important when setting a new note to code
        return {
            content: utils.isHtmlEmpty(content) ? '' : content
        };
    }

    focus() {
        this.$editor.trigger('focus');
    }

    scrollToEnd() {
        this.watchdog?.editor.model.change(writer => {
            writer.setSelection(writer.createPositionAt(this.watchdog?.editor.model.document.getRoot(), 'end'));
        });

        this.watchdog?.editor.editing.view.focus();
    }

    show() {}

    getEditor() {
        return this.watchdog?.editor;
    }

    cleanup() {
        if (this.watchdog?.editor) {
            this.spacedUpdate.allowUpdateWithoutChange(() => {
                this.watchdog.editor.setData('');
            });
        }
    }

    insertDateTimeToTextCommand() {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        this.addTextToEditor(dateString);
    }

    async addLinkToEditor(linkHref, linkTitle) {
        await this.initialized;

        this.watchdog.editor.model.change(writer => {
            const insertPosition = this.watchdog.editor.model.document.selection.getFirstPosition();
            writer.insertText(linkTitle, {linkHref: linkHref}, insertPosition);
        });
    }

    async addTextToEditor(text) {
        await this.initialized;

        this.watchdog.editor.model.change(writer => {
            const insertPosition = this.watchdog.editor.model.document.selection.getLastPosition();
            writer.insertText(text, insertPosition);
        });
    }

    addTextToActiveEditorEvent({text}) {
        if (!this.isActive()) {
            return;
        }

        this.addTextToEditor(text);
    }

    async addLink(notePath, linkTitle) {
        await this.initialized;

        if (linkTitle) {
            if (this.hasSelection()) {
                this.watchdog.editor.execute('link', `#${notePath}`);
            } else {
                await this.addLinkToEditor(`#${notePath}`, linkTitle);
            }
        }
        else {
            this.watchdog.editor.execute('referenceLink', { href: '#' + notePath });
        }

        this.watchdog.editor.editing.view.focus();
    }

    // returns true if user selected some text, false if there's no selection
    hasSelection() {
        const model = this.watchdog.editor.model;
        const selection = model.document.selection;

        return !selection.isCollapsed;
    }

    async executeWithTextEditorEvent({callback, resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        if (callback) {
            callback(this.watchdog.editor);
        }

        resolve(this.watchdog.editor);
    }

    addLinkToTextCommand() {
        const selectedText = this.getSelectedText();

        this.triggerCommand('showAddLinkDialog', {textTypeWidget: this, text: selectedText})
    }

    getSelectedText() {
        const range = this.watchdog.editor.model.document.selection.getFirstRange();
        let text = '';

        for (const item of range.getItems()) {
            if (item.data) {
                text += item.data;
            }
        }

        return text;
    }

    async followLinkUnderCursorCommand() {
        await this.initialized;

        const selection = this.watchdog.editor.model.document.selection;
        const selectedElement = selection.getSelectedElement();

        if (selectedElement?.name === 'reference') {
            // reference link
            const notePath = selectedElement.getAttribute('notePath');

            if (notePath) {
                await appContext.tabManager.getActiveContext().setNote(notePath);
                return;
            }
        }

        if (!selection.hasAttribute('linkHref')) {
            return;
        }

        const selectedLinkUrl = selection.getAttribute('linkHref');
        const notePath = link.getNotePathFromUrl(selectedLinkUrl);

        if (notePath) {
            await appContext.tabManager.getActiveContext().setNote(notePath);
        } else {
            window.open(selectedLinkUrl, '_blank');
        }
    }

    addIncludeNoteToTextCommand() {
        this.triggerCommand("showIncludeNoteDialog", {textTypeWidget: this});
    }

    addIncludeNote(noteId, boxSize) {
        this.watchdog.editor.model.change( writer => {
            // Insert <includeNote>*</includeNote> at the current selection position
            // in a way that will result in creating a valid model structure
            this.watchdog.editor.model.insertContent(writer.createElement('includeNote', {
                noteId: noteId,
                boxSize: boxSize
            }));
        } );
    }

    async addImage(noteId) {
        const note = await froca.getNote(noteId);

        this.watchdog.editor.model.change( writer => {
            const encodedTitle = encodeURIComponent(note.title);
            const src = `api/images/${note.noteId}/${encodedTitle}`;

            this.watchdog.editor.execute( 'insertImage', { source: src } );
        } );
    }

    async createNoteForReferenceLink(title) {
        const resp = await noteCreateService.createNoteWithTypePrompt(this.notePath, {
            activate: false,
            title: title
        });

        if (!resp) {
            return;
        }

        return resp.note.getBestNotePathString();
    }

    async refreshIncludedNoteEvent({noteId}) {
        this.refreshIncludedNote(this.$editor, noteId);
    }
}
