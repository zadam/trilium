import libraryLoader from "../../services/library_loader.js";
import noteAutocompleteService from '../../services/note_autocomplete.js';
import mimeTypesService from '../../services/mime_types.js';
import TypeWidget from "./type_widget.js";
import utils from "../../services/utils.js";
import appContext from "../../services/app_context.js";
import keyboardActionService from "../../services/keyboard_actions.js";
import treeCache from "../../services/tree_cache.js";
import linkService from "../../services/link.js";
import noteContentRenderer from "../../services/note_content_renderer.js";

const ENABLE_INSPECTOR = false;

const mentionSetup = {
    feeds: [
        {
            marker: '@',
            feed: queryText => {
                return new Promise((res, rej) => {
                    noteAutocompleteService.autocompleteSource(queryText, rows => {
                        if (rows.length === 1 && rows[0].title === 'No results') {
                            rows = [];
                        }

                        for (const row of rows) {
                            row.text = row.name = row.noteTitle;
                            row.id = '@' + row.text;
                            row.link = '#' + row.path;
                        }

                        res(rows);
                    });
                });
            },
            itemRenderer: item => {
                const itemElement = document.createElement('span');

                itemElement.classList.add('mentions-item');
                itemElement.innerHTML = `${item.highlightedTitle} `;

                return itemElement;
            },
            minimumCharacters: 0
        }
    ]
};

const TPL = `
<div class="note-detail-text note-detail-printable">
    <style>
    .note-detail-text h1 { font-size: 2.0em; }
    .note-detail-text h2 { font-size: 1.8em; }
    .note-detail-text h3 { font-size: 1.6em; }
    .note-detail-text h4 { font-size: 1.4em; }
    .note-detail-text h5 { font-size: 1.2em; }
    .note-detail-text h6 { font-size: 1.1em; }
    
    .note-detail-text {
        overflow: auto;
        height: 100%;
        font-family: var(--detail-text-font-family);
    }
    
    .note-detail-text-editor {
        padding-top: 10px;
        border: 0 !important;
        box-shadow: none !important;
        /* This is because with empty content height of editor is 0 and it's impossible to click into it */
        min-height: 500px;
    }
    
    .note-detail-text p:first-child, .note-detail-text::before {
        margin-top: 0;
    }
    </style>

    <div class="note-detail-text-editor" tabindex="10000"></div>
</div>
`;

export default class TextTypeWidget extends TypeWidget {
    static getType() { return "text"; }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.note-detail-text-editor');

        this.$widget.on("dblclick", "img", e => {
            const $img = $(e.target);
            const src = $img.prop("src");

            const match = src.match(/\/api\/images\/([A-Za-z0-9]+)\//);

            if (match) {
                const noteId = match[1];

                appContext.tabManager.getActiveTabContext().setNote(noteId);
            }
            else {
                window.open(src, '_blank');
            }
        });

        this.initialized = this.initEditor();

        keyboardActionService.setupActionsForElement('text-detail', this.$widget, this);

        return this.$widget;
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
            }
        });

        this.textEditor.model.document.on('change:data', () => this.spacedUpdate.scheduleUpdate());

        if (glob.isDev && ENABLE_INSPECTOR) {
            await import('../../../libraries/ckeditor/inspector.js');
            CKEditorInspector.attach(this.textEditor);
        }
    }

    async doRefresh(note) {
        this.textEditor.isReadOnly = note.hasLabel('readOnly');

        const noteComplement = await treeCache.getNoteComplement(note.noteId);

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            this.textEditor.setData(noteComplement.content);
        });
    }

    getContent() {
        const content = this.textEditor.getData();

        // if content is only tags/whitespace (typically <p>&nbsp;</p>), then just make it empty
        // this is important when setting new note to code
        return this.isContentEmpty(content) ? '' : content;
    }

    isContentEmpty(content) {
        content = content.toLowerCase();

        return jQuery(content).text().trim() === ''
            && !content.includes("<img")
            && !content.includes("<section")
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
            const insertPosition = this.textEditor.model.document.selection.getFirstPosition();
            writer.insertText(text, insertPosition);
        });
    }

    addTextToActiveEditorEvent(text) {
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

    async executeInActiveEditorEvent({callback}) {
        if (!this.isActive()) {
            return;
        }

        await this.initialized;

        callback(this.textEditor);
    }

    addLinkToTextCommand() {
        import("../../dialogs/add_link.js").then(d => d.showDialog(this));
    }

    addIncludeNoteToTextCommand() {
        import("../../dialogs/include_note.js").then(d => d.showDialog(this));
    }

    async loadIncludedNote(noteId, el) {
        const note = await treeCache.getNote(noteId);

        if (note) {
            $(el).empty().append($("<h3>").append(await linkService.createNoteLink(note.noteId, {
                showTooltip: false
            })));

            const {renderedContent} = await noteContentRenderer.getRenderedContent(note);

            $(el).append(renderedContent);
        }
    }

    addIncludeNote(noteId) {
        this.textEditor.model.change( writer => {
            // Insert <includeNote>*</includeNote> at the current selection position
            // in a way that will result in creating a valid model structure
            this.textEditor.model.insertContent(writer.createElement('includeNote', {
                noteId: noteId
            }));
        } );
    }

    async addImage(noteId) {
        const note = await treeCache.getNote(noteId);

        this.textEditor.model.change( writer => {
            const src = `api/images/${note.noteId}/${note.title}`;

            const imageElement = writer.createElement( 'image',  { 'src': src } );

            this.textEditor.model.insertContent(imageElement, this.textEditor.model.document.selection);
        } );
    }
}