import TabAwareWidget from "./tab_aware_widget.js";
import libraryLoader from "../services/library_loader.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import treeCache from "../services/tree_cache.js";
import server from "../services/server.js";
import ws from "../services/ws.js";
import SpacedUpdate from "../services/spaced_update.js";
import attributesParser from "../services/attribute_parser.js";
import AttributeDetailWidget from "./attribute_detail.js";

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
    .note-attributes {
        margin-left: 7px;
        margin-right: 7px;
    }
    
    .note-attributes-editor {
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        padding: 0 0 0 5px !important;
        margin: 0 !important;
        color: var(--muted-text-color);
        max-height: 200px;
        overflow: auto;
    }
    
    .inherited-attributes {
        color: var(--muted-text-color);
        max-height: 200px;
        overflow: auto;
    }
    
    .note-attributes-editor p {
        margin: 0 !important;
    }
    
    .note-attributes.error .note-attributes-editor {
        border-color: red !important;
    }
    
    .attr-expander {
        display: flex; 
        flex-direction: row; 
        color: var(--muted-text-color); 
        font-size: small;
    }
    
    .note-attributes hr {
        height: 1px;
        border-color: var(--main-border-color);
        position: relative;
        top: 4px;
        margin-top: 5px;
        margin-bottom: 0;
    }
    
    .attr-expander-text {
        padding-left: 20px;
        padding-right: 20px;
        white-space: nowrap;
    }
    
    .attr-expander:hover {
        cursor: pointer;
    }
    
    .attr-expander:not(.error):hover hr {
        border-color: black;
    }
    
    .attr-expander:not(.error):hover .attr-expander-text {
        color: black;
    }
    
    .attr-expander.error .attr-expander-text {
        color: red;
    }
    
    .attr-expander.error hr {
        border-color: red;
    }
</style>

<div class="attr-expander attr-owned-expander">
    <hr class="w-100">
    
    <div class="attr-expander-text"></div>
    
    <hr class="w-100">
</div>

<div class="attr-display">
    <div class="note-attributes-editor" tabindex="200"></div>
    
    <hr class="w-100 attr-inherited-empty-expander">
    
    <div class="attr-expander attr-inherited-expander">
        <hr class="w-100">
        
        <div class="attr-expander-text">5 inherited attributes</div>
        
        <hr class="w-100">
    </div>
    
    <div class="inherited-attributes"></div>
</div>

</div>
`;

export default class NoteAttributesWidget extends TabAwareWidget {
    constructor() {
        super();

        this.attributeDetailWidget = new AttributeDetailWidget().setParent(this);

        this.spacedUpdate = new SpacedUpdate(() => {
            this.parseAttributes();

            this.attributeDetailWidget.hide();
        });
    }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.note-attributes-editor');

        this.initialized = this.initEditor();

        this.$attrDisplay = this.$widget.find('.attr-display');

        this.$ownedExpander = this.$widget.find('.attr-owned-expander');
        this.$ownedExpander.on('click', () => {
            if (this.$attrDisplay.is(":visible")) {
                this.$attrDisplay.slideUp(200);
            }
            else {
                this.$attrDisplay.slideDown(200);
            }
        });

        this.$ownedExpanderText = this.$ownedExpander.find('.attr-expander-text');

        this.$inheritedAttributes = this.$widget.find('.inherited-attributes');

        this.$inheritedExpander = this.$widget.find('.attr-inherited-expander');
        this.$inheritedExpander.on('click', () => {
            if (this.$inheritedAttributes.is(":visible")) {
                this.$inheritedAttributes.slideUp(200);
            }
            else {
                this.$inheritedAttributes.slideDown(200);
            }
        });

        this.$inheritedExpanderText = this.$inheritedExpander.find('.attr-expander-text');

        this.$inheritedEmptyExpander = this.$widget.find('.attr-inherited-empty-expander');

        this.$editor.on('keydown', async e => {
            const keycode = (e.keyCode ? e.keyCode : e.which);

            if (keycode === 13) {
                this.triggerCommand('focusOnDetail', {tabId: this.tabContext.tabId});

                await this.save();
            }

            this.attributeDetailWidget.hide();
        });

        this.$editor.on('blur', () => {
            this.save();

            this.attributeDetailWidget.hide();
        });

        this.$widget.append(this.attributeDetailWidget.render());
    }

    async save() {
        const attributes = this.parseAttributes();

        if (attributes) {
            await server.put(`notes/${this.noteId}/attributes2`, attributes, this.componentId);
        }
    }

    parseAttributes() {
        try {
            const attrs = attributesParser.lexAndParse(this.textEditor.getData());

            this.$widget.removeClass("error");
            this.$widget.removeAttr("title");

            this.$ownedExpander.removeClass("error");
            this.$ownedExpanderText.text(attrs.length + ' owned ' + this.attrPlural(attrs.length));

            return attrs;
        }
        catch (e) {
            this.$widget.attr("title", e.message);
            this.$widget.addClass("error");

            this.$ownedExpander.addClass("error");
            this.$ownedExpanderText.text(e.message);
        }
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

                for (const attr of parsedAttrs) {
                    if (clickIndex >= attr.startIndex && clickIndex <= attr.endIndex) {
                        matchedAttr = attr;
                        break;
                    }
                }

                this.attributeDetailWidget.showAttributeDetail(matchedAttr, e.pageX, e.pageY);
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

        // disable spellcheck for attribute editor
        this.textEditor.editing.view.change( writer => {
            writer.setAttribute( 'spellcheck', 'false', this.textEditor.editing.view.document.getRoot() );
        } );

        //await import(/* webpackIgnore: true */'../../libraries/ckeditor/inspector.js');
        //CKEditorInspector.attach(this.textEditor);
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

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            this.textEditor.setData($attributesContainer.html());
        });

        const inheritedAttributes = note.getAttributes().filter(attr => attr.isInheritable && attr.noteId !== this.noteId);
        const inheritedAttributeCount = inheritedAttributes.length;

        if (inheritedAttributeCount === 0) {
            this.$inheritedExpander.hide();
            this.$inheritedEmptyExpander.show();
        }
        else {
            this.$inheritedExpander.show();
            this.$inheritedEmptyExpander.hide();
        }

        this.$inheritedExpanderText.text(inheritedAttributeCount + ' inherited ' + this.attrPlural(inheritedAttributeCount));

        await this.renderAttributes(inheritedAttributes, this.$inheritedAttributes);
    }

    attrPlural(number) {
        return 'attribute' + (number === 1 ? '' : 's');
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
                $container.append(document.createTextNode('#' + attribute.name));

                if (attribute.value) {
                    $container.append('=');
                    $container.append(document.createTextNode(this.formatValue(attribute.value)));
                }

                $container.append(' ');
            } else if (attribute.type === 'relation') {
                if (attribute.isAutoLink) {
                    continue;
                }

                if (attribute.value) {
                    $container.append(document.createTextNode('~' + attribute.name + "="));
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

    formatValue(val) {
        if (!/[^\w_-]/.test(val)) {
            return val;
        }
        else if (!val.includes('"')) {
            return '"' + val + '"';
        }
        else if (!val.includes("'")) {
            return "'" + val + "'";
        }
        else if (!val.includes("`")) {
            return "`" + val + "`";
        }
        else {
            return '"' + val.replace(/"/g, '\\"') + '"';
        }
    }

    async focusOnAttributesEvent({tabId}) {
        if (this.tabContext.tabId === tabId) {
            this.$editor.trigger('focus');
        }
    }
}
