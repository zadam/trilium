import TabAwareWidget from "./tab_aware_widget.js";
import libraryLoader from "../services/library_loader.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import treeCache from "../services/tree_cache.js";
import server from "../services/server.js";
import utils from "../services/utils.js";
import ws from "../services/ws.js";
import SpacedUpdate from "../services/spaced_update.js";
import attributesParser from "../services/attribute_parser.js";
import linkService from "../services/link.js";
import treeService from "../services/tree.js";

const mentionSetup = {
    feeds: [
        {
            marker: '@',
            feed: queryText => {
                return new Promise((res, rej) => {
                    noteAutocompleteService.autocompleteSource(queryText, rows => {
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
        },
        {
            marker: '#',
            feed: async queryText => {
                const names = await server.get(`attributes/names/?type=label&query=${encodeURIComponent(queryText)}`);

                return names.map(name => {
                    return {
                        id: '#' + name,
                        name: name
                    }
                });
            },
            minimumCharacters: 0,
            attributeMention: true
        },
        {
            marker: '~',
            feed: async queryText => {
                const names = await server.get(`attributes/names/?type=relation&query=${encodeURIComponent(queryText)}`);

                return names.map(name => {
                    return {
                        id: '~' + name,
                        name: name
                    }
                });
            },
            minimumCharacters: 0,
            attributeMention: true
        }
    ]
};

const TPL = `
<div class="note-attributes">
<style>
.note-attributes-editor p {
    color: var(--muted-text-color);
    margin-top: 5px !important;
    margin-bottom: 5px !important;
}

.attr-extras {
    display: block;
    background-color: var(--accented-background-color);
    border: 1px solid var(--main-border-color);
    border-radius: 4px;
    z-index: 1000;
    padding: 10px;
    position: absolute;
    max-width: 400px;
    max-height: 500px;
    overflow: auto;
}
</style>

<div class="attr-extras" style="display: none;">
    <div class="attr-extras-title"></div>
    
    <div class="attr-extras-list"></div>
    
    <div class="attr-extras-more-notes"></div>
</div>

<div class="note-attributes-editor"></div>
</div>
`;

const DISPLAYED_NOTES = 10;

export default class NoteAttributesWidget extends TabAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(async () => {
            const content = this.textEditor.getData();

            this.parse(content);
        });
    }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.note-attributes-editor');
        this.$attrExtras = this.$widget.find('.attr-extras');
        this.$attrExtrasTitle = this.$widget.find('.attr-extras-title');
        this.$attrExtrasList = this.$widget.find('.attr-extras-list');
        this.$attrExtrasMoreNotes = this.$widget.find('.attr-extras-more-notes');
        this.initialized = this.initEditor();

        this.$editor.keypress(async e => {
            const keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode === 13) {
                const attributes = attributesParser.lexAndParse(this.textEditor.getData());

                await server.put(`notes/${this.noteId}/attributes2`, attributes, this.componentId);

                console.log("Saved!");
            }
        })

        return this.$widget;
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        // CKEditor since version 12 needs the element to be visible before initialization. At the same time
        // we want to avoid flicker - i.e. show editor only once everything is ready. That's why we have separate
        // display of $widget in both branches.
        this.$widget.show();

        this.$editor.on("click", async e => {
            const pos = this.textEditor.model.document.selection.getFirstPosition();

            if (pos && pos.textNode && pos.textNode.data) {
                const attrText = pos.textNode.data;
                const clickIndex = pos.offset - pos.textNode.startOffset;

                const parsedAttrs = attributesParser.lexAndParse(attrText, true);

                let matchedAttr = null;
                let matchedPart = null;

                for (const attr of parsedAttrs) {
                    if (clickIndex >= attr.nameStartIndex && clickIndex <= attr.nameEndIndex) {
                        matchedAttr = attr;
                        matchedPart = 'name';
                        break;
                    }

                    if (clickIndex >= attr.valueStartIndex && clickIndex <= attr.valueEndIndex) {
                        matchedAttr = attr;
                        matchedPart = 'value';
                        break;
                    }
                }

                if (!matchedAttr) {
                    console.log(`Not found attribute for index ${clickIndex}, attr: ${JSON.stringify(parsedAttrs)}, text: ${attrText}`);

                    return;
                }

                let noteIds = await server.post('attributes/notes-with-attribute', {
                    type: matchedAttr.type,
                    name: matchedAttr.name,
                    value: matchedPart === 'value' ? matchedAttr.value : undefined
                });

                noteIds = noteIds.filter(noteId => noteId !== this.noteId);

                if (noteIds.length === 0) {
                    this.$attrExtrasTitle.text(
                        `There are no other notes with ${matchedAttr.type} name "${matchedAttr.name}"`
                        // not displaying value since it can be long
                        + (matchedPart === 'value' ? " and matching value" : ""));
                }
                else {
                    this.$attrExtrasTitle.text(
                        `Notes with ${matchedAttr.type} name "${matchedAttr.name}"`
                        // not displaying value since it can be long
                        + (matchedPart === 'value' ? " and matching value" : "")
                        + ":"
                    );
                }

                this.$attrExtrasList.empty();

                const displayedNoteIds = noteIds.length <= DISPLAYED_NOTES ? noteIds : noteIds.slice(0, DISPLAYED_NOTES);
                const displayedNotes = await treeCache.getNotes(displayedNoteIds);
console.log(displayedNoteIds, displayedNotes);
                for (const note of displayedNotes) {
                    const notePath = treeService.getSomeNotePath(note);
                    const $noteLink = await linkService.createNoteLink(notePath, {showNotePath: true});

                    this.$attrExtrasList.append(
                        $("<li>").append($noteLink)
                    );
                }

                if (noteIds.length > DISPLAYED_NOTES) {
                    this.$attrExtrasMoreNotes.show().text(`... and ${noteIds.length - DISPLAYED_NOTES} more.`);
                }
                else {
                    this.$attrExtrasMoreNotes.hide();
                }

                this.$attrExtras.css("left", e.pageX - this.$attrExtras.width() / 2);
                this.$attrExtras.css("top", e.pageY + 20);
                this.$attrExtras.show();
            }
        });

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

        this.textEditor.model.document.on('change:data', () => this.spacedUpdate.scheduleUpdate());

        await import(/* webpackIgnore: true */'../../libraries/ckeditor/inspector.js');
        CKEditorInspector.attach(this.textEditor);
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

    async refreshWithNote(note) {
        const ownedAttributes = note.getOwnedAttributes();
        const $attributesContainer = $("<div>");

        await this.renderAttributes(ownedAttributes, $attributesContainer);
console.log($attributesContainer.html());
        this.textEditor.setData($attributesContainer.html());
    }

    createNoteLink(noteId) {
        return $("<a>", {
            href: '#' + noteId,
            class: 'reference-link',
            'data-note-path': noteId
        });
    }

    async renderAttributes(attributes, $container) {
        for (const attribute of attributes) {
            if (attribute.type === 'label') {
                $container.append(utils.formatLabel(attribute) + " ");
            } else if (attribute.type === 'relation') {
                if (attribute.isAutoLink) {
                    continue;
                }

                if (attribute.value) {
                    $container.append('~' + attribute.name + "=");
                    $container.append(this.createNoteLink(attribute.value));
                    $container.append(" ");
                } else {
                    ws.logError(`Relation ${attribute.attributeId} has empty target`);
                }
            } else {
                ws.logError("Unknown attr type: " + attribute.type);
            }
        }
    }

    parse(content) {
        if (content.startsWith('<p>')) {
            content = content.substr(3);
        }

        if (content.endsWith('</p>')) {
            content = content.substr(0, content - 4);
        }

        console.log(content);
    }
}
