import libraryLoader from "../../services/library_loader.js";
import noteAutocompleteService from '../../services/note_autocomplete.js';
import mimeTypesService from '../../services/mime_types.js';
import utils from "../../services/utils.js";
import keyboardActionService from "../../services/keyboard_actions.js";
import froca from "../../services/froca.js";
import treeService from "../../services/tree.js";
import noteCreateService from "../../services/note_create.js";
import AbstractTextTypeWidget from "./abstract_text_type_widget.js";
import link from "../../services/link.js";
import appContext from "../../services/app_context.js";

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
    
    .note-detail-editable-text a:hover {
        cursor: pointer;
    }
    
    .note-detail-editable-text a[href^="http://"], .note-detail-editable-text a[href^="https://"] {
        cursor: text !important;
    }
    
    .note-detail-editable-text *:not(figure):first-child {
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
    static getType() { return "editable-text"; }

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

        // CKEditor since version 12 needs the element to be visible before initialization. At the same time
        // we want to avoid flicker - i.e. show editor only once everything is ready. That's why we have separate
        // display of $widget in both branches.
        this.$widget.show();

        this.textEditor = await BalloonEditor.create(this.$editor[0], {
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

        this.textEditor.model.document.on('change:data', () => this.spacedUpdate.scheduleUpdate());

        if (glob.isDev && ENABLE_INSPECTOR) {
            await import(/* webpackIgnore: true */'../../../libraries/ckeditor/inspector.js');
            CKEditorInspector.attach(this.textEditor);
        }
    }

    async doRefresh(note) {
        const noteComplement = await froca.getNoteComplement(note.noteId);

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            this.textEditor.setData(noteComplement.content || "");
        });
    }

    getContent() {
        const content = this.textEditor.getData();

        // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
        // this is important when setting new note to code
        return utils.isHtmlEmpty(content) ? '' : content;
    }

    focus() {
        this.$editor.trigger('focus');
    }

    show() {}

    getEditor() {
        return this.textEditor;
    }

    cleanup() {
        if (this.textEditor) {
            this.spacedUpdate.allowUpdateWithoutChange(() => {
                this.textEditor.setData('');
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

        this.textEditor.model.change(writer => {
            const insertPosition = this.textEditor.model.document.selection.getFirstPosition();
            writer.insertText(linkTitle, {linkHref: linkHref}, insertPosition);
        });
    }

    async addTextToEditor(text) {
        await this.initialized;

        this.textEditor.model.change(writer => {
            const insertPosition = this.textEditor.model.document.selection.getLastPosition();
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
                this.textEditor.execute('link', '#' + notePath);
            } else {
                await this.addLinkToEditor('#' + notePath, linkTitle);
            }
        }
        else {
            this.textEditor.execute('referenceLink', { notePath: notePath });
        }

        this.textEditor.editing.view.focus();
    }

    // returns true if user selected some text, false if there's no selection
    hasSelection() {
        const model = this.textEditor.model;
        const selection = model.document.selection;

        return !selection.isCollapsed;
    }

    async executeWithTextEditorEvent({callback, resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        if (callback) {
            callback(this.textEditor);
        }

        resolve(this.textEditor);
    }

    addLinkToTextCommand() {
        const selectedText = this.getSelectedText();

        import("../../dialogs/add_link.js").then(d => d.showDialog(this, selectedText));
    }

    getSelectedText() {
        const range = this.textEditor.model.document.selection.getFirstRange();
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

        const selection = this.textEditor.model.document.selection;
        if (!selection.hasAttribute('linkHref')) return;

        const selectedLinkUrl = selection.getAttribute('linkHref');
        const notePath = link.getNotePathFromUrl(selectedLinkUrl);
        if (notePath) {
            await appContext.tabManager.getActiveContext().setNote(notePath);
        } else {
            window.open(selectedLinkUrl, '_blank');
        }
    }

    addIncludeNoteToTextCommand() {
        import("../../dialogs/include_note.js").then(d => d.showDialog(this));
    }

    addIncludeNote(noteId, boxSize) {
        this.textEditor.model.change( writer => {
            // Insert <includeNote>*</includeNote> at the current selection position
            // in a way that will result in creating a valid model structure
            this.textEditor.model.insertContent(writer.createElement('includeNote', {
                noteId: noteId,
                boxSize: boxSize
            }));
        } );
    }

    async addImage(noteId) {
        const note = await froca.getNote(noteId);

        this.textEditor.model.change( writer => {
            const src = `api/images/${note.noteId}/${note.title}`;

            const imageElement = writer.createElement( 'image',  { 'src': src } );

            this.textEditor.model.insertContent(imageElement, this.textEditor.model.document.selection);
        } );
    }

    async createNoteForReferenceLink(title) {
        const {note} = await noteCreateService.createNote(this.notePath, {
            activate: false,
            title: title
        });

        return treeService.getSomeNotePath(note);
    }

    async refreshIncludedNoteEvent({noteId}) {
        this.refreshIncludedNote(this.$editor, noteId);
    }
}
