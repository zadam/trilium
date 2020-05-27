import TabAwareWidget from "./tab_aware_widget.js";
import libraryLoader from "../services/library_loader.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import treeCache from "../services/tree_cache.js";

const mentionSetup = {
    feeds: [
        {
            marker: '@',
            feed: queryText => {
                return new Promise((res, rej) => {
                    noteAutocompleteService.autocompleteSource(queryText, rows => {
                        console.log("rows", rows);

                        res(rows.map(row => {
                            return {
                                id: '@' + row.notePathTitle,
                                name: row.notePathTitle,
                                link: '#' + row.notePath,
                                notePath: row.notePath,
                                highlightedNotePathTitle: row.highlightedNotePathTitle
                            }
                        }));
                    });
                });
            },
            itemRenderer: item => {
                const itemElement = document.createElement('span');

                itemElement.classList.add('mentions-item');
                itemElement.innerHTML = `${item.highlightedNotePathTitle} `;

                return itemElement;
            },
            minimumCharacters: 0
        }
    ]
};

const TPL = `
<div class="note-attributes">
<div class="note-attributes-editor"></div>
</div>
`;

export default class NoteAttributesWidget extends TabAwareWidget {
    constructor() {
        super();
    }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.note-attributes-editor');
        // this.$noteTitle = this.$widget.find(".note-attributes");
        //
        // this.$noteTitle.on('input', () => this.spacedUpdate.scheduleUpdate());
        //
        // utils.bindElShortcut(this.$noteTitle, 'return', () => {
        //     this.triggerCommand('focusOnDetail', {tabId: this.tabContext.tabId});
        // });

        this.initialized = this.initEditor();

        return this.$widget;
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        // CKEditor since version 12 needs the element to be visible before initialization. At the same time
        // we want to avoid flicker - i.e. show editor only once everything is ready. That's why we have separate
        // display of $widget in both branches.
        this.$widget.show();

        this.textEditor = await BalloonEditor.create(this.$editor[0], {
            removePlugins: [
                'Enter',
                'ShiftEnter',
                'Heading',
                'Link',
                'Autoformat',
                'Bold',
                'Italic',
                'Underline',
                'Strikethrough',
                'Code',
                'Superscript',
                'Subscript',
                'BlockQuote',
                'Image',
                'ImageCaption',
                'ImageStyle',
                'ImageToolbar',
                'ImageUpload',
                'ImageResize',
                'List',
                'TodoList',
                'PasteFromOffice',
                'Table',
                'TableToolbar',
                'TableProperties',
                'TableCellProperties',
                'Indent',
                'IndentBlock',
                'BlockToolbar',
                'ParagraphButtonUI',
                'HeadingButtonsUI',
                'UploadimagePlugin',
                'InternalLinkPlugin',
                'MarkdownImportPlugin',
                'CuttonotePlugin',
                'TextTransformation',
                'Font',
                'FontColor',
                'FontBackgroundColor',
                'CodeBlock',
                'SelectAll',
                'IncludeNote',
                'CutToNote'
            ],
            toolbar: {
                items: []
            },
            placeholder: "Type the labels and relations here ...",
            mention: mentionSetup
        });

        //this.textEditor.model.document.on('change:data', () => this.spacedUpdate.scheduleUpdate());
    }

    async loadReferenceLinkTitle(noteId, $el) {
        const note = await treeCache.getNote(noteId, true);

        let title;

        if (!note) {
            title = '[missing]';
        }
        else if (!note.isDeleted) {
            title = note.title;
        }
        else {
            title = note.isErased ? '[erased]' : `${note.title} (deleted)`;
        }

        $el.text(title);
    }
}
