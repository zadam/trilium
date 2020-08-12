import TabAwareWidget from "./tab_aware_widget.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import server from "../services/server.js";
import contextMenuService from "../services/context_menu.js";
import attributesParser from "../services/attribute_parser.js";
import libraryLoader from "../services/library_loader.js";
import treeCache from "../services/tree_cache.js";
import attributeRenderer from "../services/attribute_renderer.js";

const TPL = `
<div style="position: relative">
    <style>
    .attribute-list-editor {
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        padding: 0 0 0 5px !important;
        margin: 0 !important;
        color: var(--muted-text-color);
        max-height: 100px;
        overflow: auto;
    }
        
    .save-attributes-button {
        color: var(--muted-text-color);
        position: absolute; 
        bottom: 3px;
        right: 25px;
        cursor: pointer;
        border: 1px solid transparent;
        font-size: 130%;
    }
    
    .add-new-attribute-button {
        color: var(--muted-text-color);
        position: absolute; 
        bottom: 3px;
        right: 0; 
        cursor: pointer;
        border: 1px solid transparent;
        font-size: 130%;
    }
    
    .add-new-attribute-button:hover, .save-attributes-button:hover {
        border: 1px solid var(--main-border-color);
        border-radius: 2px;
    }
    
    .attribute-errors {
        color: red;
    }
    </style>
    
    <div class="attribute-list-editor" tabindex="200"></div>

    <div class="bx bx-save save-attributes-button" title="Save attributes <enter>"></div>
    <div class="bx bx-plus add-new-attribute-button" title="Add a new attribute"></div>
    
    <div class="attribute-errors" style="display: none;"></div>
</div>
`;

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
                const itemElement = document.createElement('button');

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

const editorConfig = {
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
    placeholder: "Type the labels and relations here, e.g. #year=2020",
    mention: mentionSetup
};

export default class AttributeEditorWidget extends TabAwareWidget {
    constructor(attributeDetailWidget) {
        super();

        this.attributeDetailWidget = attributeDetailWidget;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$editor = this.$widget.find('.attribute-list-editor');

        this.initialized = this.initEditor();

        this.$editor.on('keydown', async e => {
            const keycode = (e.keyCode ? e.keyCode : e.which);

            if (keycode === 13) {
                this.triggerCommand('focusOnDetail', {tabId: this.tabContext.tabId});

                await this.save();
            }

            this.attributeDetailWidget.hide();
        });

        this.$editor.on('blur', () => this.save());

        this.$addNewAttributeButton = this.$widget.find('.add-new-attribute-button');
        this.$addNewAttributeButton.on('click', e => this.addNewAttribute(e));

        this.$saveAttributesButton = this.$widget.find('.save-attributes-button');
        this.$saveAttributesButton.on('click', () => this.save());

        this.$errors = this.$widget.find('.attribute-errors');
    }

    addNewAttribute(e) {
        contextMenuService.show({
            x: e.pageX,
            y: e.pageY,
            orientation: 'left',
            items: [
                {title: "Add new label", command: "addNewLabel", uiIcon: "hash"},
                {title: "Add new relation", command: "addNewRelation", uiIcon: "transfer"},
                {title: "----"},
                {title: "Add new label definition", command: "addNewLabelDefinition", uiIcon: "empty"},
                {title: "Add new relation definition", command: "addNewRelationDefinition", uiIcon: "empty"},
            ],
            selectMenuItemHandler: ({command}) => this.handleAddNewAttributeCommand(command)
        });
    }

    async handleAddNewAttributeCommand(command) {
        const attrs = this.parseAttributes();

        if (!attrs) {
            return;
        }

        let type, name, value;

        if (command === 'addNewLabel') {
            type = 'label';
            name = 'myLabel';
            value = '';
        } else if (command === 'addNewRelation') {
            type = 'relation';
            name = 'myRelation';
            value = '';
        } else if (command === 'addNewLabelDefinition') {
            type = 'label';
            name = 'label:myLabel';
            value = 'promoted,single,text';
        } else if (command === 'addNewRelationDefinition') {
            type = 'label';
            name = 'relation:myRelation';
            value = 'promoted,single';
        } else {
            return;
        }

        attrs.push({
            type,
            name,
            value,
            isInheritable: false
        });

        await this.renderOwnedAttributes(attrs, false);

        this.$editor.scrollTop(this.$editor[0].scrollHeight);

        const rect = this.$editor[0].getBoundingClientRect();

        setTimeout(() => {
            // showing a little bit later because there's a conflict with outside click closing the attr detail
            this.attributeDetailWidget.showAttributeDetail({
                allAttributes: attrs,
                attribute: attrs[attrs.length - 1],
                isOwned: true,
                x: (rect.left + rect.right) / 2,
                y: rect.bottom
            });
        }, 100);
    }

    async save() {
        const attributes = this.parseAttributes();

        if (attributes) {
            await server.put(`notes/${this.noteId}/attributes`, attributes, this.componentId);

            this.$saveAttributesButton.fadeOut();
        }
    }

    parseAttributes() {
        try {
            const attrs = attributesParser.lexAndParse(this.textEditor.getData());

            return attrs;
        }
        catch (e) {
            this.$errors.show().text(e.message);
        }
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        this.$widget.show();

        this.$editor.on("click", e => this.handleEditorClick(e));

        this.textEditor = await BalloonEditor.create(this.$editor[0], editorConfig);
        this.textEditor.model.document.on('change:data', () => this.dataChanged());

        // disable spellcheck for attribute editor
        this.textEditor.editing.view.change(writer => writer.setAttribute('spellcheck', 'false', this.textEditor.editing.view.document.getRoot()));

        //await import(/* webpackIgnore: true */'../../libraries/ckeditor/inspector.js');
        //CKEditorInspector.attach(this.textEditor);
    }

    dataChanged() {
        if (this.lastSavedContent === this.textEditor.getData()) {
            this.$saveAttributesButton.fadeOut();
        }
        else {
            this.$saveAttributesButton.fadeIn();
        }

        if (this.$errors.is(":visible")) {
            this.$errors.slideUp();
        }
    }

    async handleEditorClick(e) {
        const pos = this.textEditor.model.document.selection.getFirstPosition();

        if (pos && pos.textNode && pos.textNode.data) {
            const clickIndex = this.getClickIndex(pos);

            let parsedAttrs;

            try {
                parsedAttrs = attributesParser.lexAndParse(this.textEditor.getData(), true);
            }
            catch (e) {
                // the input is incorrect because user messed up with it and now needs to fix it manually
                return null;
            }

            let matchedAttr = null;

            for (const attr of parsedAttrs) {
                if (clickIndex > attr.startIndex && clickIndex <= attr.endIndex) {
                    matchedAttr = attr;
                    break;
                }
            }

            this.attributeDetailWidget.showAttributeDetail({
                allAttributes: parsedAttrs,
                attribute: matchedAttr,
                isOwned: true,
                x: e.pageX,
                y: e.pageY
            });
        }
    }

    getClickIndex(pos) {
        let clickIndex = pos.offset - pos.textNode.startOffset;

        let curNode = pos.textNode;

        while (curNode.previousSibling) {
            curNode = curNode.previousSibling;

            if (curNode.name === 'reference') {
                clickIndex += curNode._attrs.get('notePath').length + 1;
            } else {
                clickIndex += curNode.data.length;
            }
        }

        return clickIndex;
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
        await this.renderOwnedAttributes(note.getOwnedAttributes(), true);
    }

    async renderOwnedAttributes(ownedAttributes, saved) {
        const $attributesContainer = $("<div>");

        for (const attribute of ownedAttributes) {
            attributeRenderer.renderAttribute(attribute, $attributesContainer, true);
        }

        this.textEditor.setData($attributesContainer.html());

        if (saved) {
            this.lastSavedContent = this.textEditor.getData();

            this.$saveAttributesButton.fadeOut(0);
        }
    }

    async focusOnAttributesEvent({tabId}) {
        if (this.tabContext.tabId === tabId) {
            this.$editor.trigger('focus');
        }
    }

    updateAttributeList(attributes) {
        this.renderOwnedAttributes(attributes, false);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attr.isAffecting(this.note))) {
            this.refresh();
        }
    }
}
