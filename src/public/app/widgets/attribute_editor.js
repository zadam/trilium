import TabAwareWidget from "./tab_aware_widget.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import server from "../services/server.js";
import contextMenuService from "../services/context_menu.js";
import attributesParser from "../services/attribute_parser.js";
import libraryLoader from "../services/library_loader.js";
import treeCache from "../services/tree_cache.js";
import attributeRenderer from "../services/attribute_renderer.js";
import noteCreateService from "../services/note_create.js";
import treeService from "../services/tree.js";

const HELP_TEXT = `
<p>To add label, just type e.g. <code>#rock</code> or if you want to add also value then e.g. <code>#year = 2020</code></p> 

<p>For relation, type <code>~author = @</code> which should bring up an autocomplete where you can look up the desired note.</p>

<p>Alternatively you can add label and relation using the <code>+</code> button on the right side.</p>`;

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
        transition: opacity .1s linear;
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
        bottom: 2px;
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
        padding: 5px 50px 0px 5px; /* large right padding to avoid buttons */
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
            feed: queryText => noteAutocompleteService.autocompleteSourceForCKEditor(queryText),
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
    placeholder: "Type the labels and relations here",
    mention: mentionSetup
};

export default class AttributeEditorWidget extends TabAwareWidget {
    constructor(attributeDetailWidget) {
        super();

        this.attributeDetailWidget = attributeDetailWidget;
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$editor = this.$widget.find('.attribute-list-editor');

        this.initialized = this.initEditor();

        this.$editor.on('keydown', async e => {
            if (e.which === 13) {
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
                {title: `Add new label <kbd data-command="addNewLabel"></kbd>`, command: "addNewLabel", uiIcon: "hash"},
                {title: `Add new relation <kbd data-command="addNewRelation"></kbd>`, command: "addNewRelation", uiIcon: "transfer"},
                {title: "----"},
                {title: "Add new label definition", command: "addNewLabelDefinition", uiIcon: "empty"},
                {title: "Add new relation definition", command: "addNewRelationDefinition", uiIcon: "empty"},
            ],
            selectMenuItemHandler: ({command}) => this.handleAddNewAttributeCommand(command)
        });
    }

    // triggered from keyboard shortcut
    addNewLabelEvent({tabId}) {
        if (this.isTab(tabId)) {
            this.handleAddNewAttributeCommand('addNewLabel');
        }
    }

    // triggered from keyboard shortcut
    addNewRelationEvent({tabId}) {
        if (this.isTab(tabId)) {
            this.handleAddNewAttributeCommand('addNewRelation');
        }
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
                y: rect.bottom,
                focus: 'name'
            });
        }, 100);
    }

    async save() {
        const attributes = this.parseAttributes();

        if (attributes) {
            await server.put(`notes/${this.noteId}/attributes`, attributes, this.componentId);

            this.$saveAttributesButton.fadeOut();

            // blink the attribute text to give visual hint that save has been executed
            this.$editor.css('opacity', 0);

            // revert back
            setTimeout(() => this.$editor.css('opacity', 1), 100);
        }
    }

    parseAttributes() {
        try {
            const attrs = attributesParser.lexAndParse(this.getPreprocessedData());

            return attrs;
        }
        catch (e) {
            this.$errors.text(e.message).slideDown();
        }
    }

    getPreprocessedData() {
        const str = this.textEditor.getData()
            .replace(/<a[^>]+href="(#[A-Za-z0-9/]*)"[^>]*>[^<]*<\/a>/g, "$1")
            .replace(/&nbsp;/g, " "); // otherwise .text() below outputs non-breaking space in unicode

        return $("<div>").html(str).text();
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
            // using .hide() instead of .slideUp() since this will also hide the error after confirming
            // mention for relation name which suits up. When using.slideUp() error will appear and the slideUp which is weird
            this.$errors.hide();
        }
    }

    async handleEditorClick(e) {
        const pos = this.textEditor.model.document.selection.getFirstPosition();

        if (pos && pos.textNode && pos.textNode.data) {
            const clickIndex = this.getClickIndex(pos);

            let parsedAttrs;

            try {
                parsedAttrs = attributesParser.lexAndParse(this.getPreprocessedData(), true);
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

            setTimeout(() => {
                if (matchedAttr) {
                    this.$editor.tooltip('hide');

                    this.attributeDetailWidget.showAttributeDetail({
                        allAttributes: parsedAttrs,
                        attribute: matchedAttr,
                        isOwned: true,
                        x: e.pageX,
                        y: e.pageY
                    });
                }
                else {
                    this.showHelpTooltip();
                }
            }, 100);
        }
        else {
            this.showHelpTooltip();
        }
    }

    showHelpTooltip() {
        this.attributeDetailWidget.hide();

        this.$editor.tooltip({
            trigger: 'focus',
            html: true,
            title: HELP_TEXT,
            placement: 'bottom',
            offset: "0,30"
        });

        this.$editor.tooltip('show');
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
        ownedAttributes = ownedAttributes.filter(oa => !oa.isDeleted);

        let htmlAttrs = (await attributeRenderer.renderAttributes(ownedAttributes, true)).html();

        if (htmlAttrs.length > 0) {
            htmlAttrs += "&nbsp;";
        }

        this.textEditor.setData(htmlAttrs);

        if (saved) {
            this.lastSavedContent = this.textEditor.getData();

            this.$saveAttributesButton.fadeOut(0);
        }
    }

    async focusOnAttributesEvent({tabId}) {
        if (this.tabContext.tabId === tabId) {
            if (this.$editor.is(":visible")) {
                this.$editor.trigger('focus');

                this.textEditor.model.change(writer => { // put focus to the end of the content
                    writer.setSelection(writer.createPositionAt(this.textEditor.model.document.getRoot(), 'end'));
                });
            }
            else {
                this.triggerCommand('focusOnDetail', {tabId: this.tabContext.tabId});
            }
        }
    }

    async createNoteForReferenceLink(title) {
        const {note} = await noteCreateService.createNote(this.noteId, {
            activate: false,
            title: title
        });

        return treeService.getSomeNotePath(note);
    }

    async updateAttributeList(attributes) {
        await this.renderOwnedAttributes(attributes, false);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attr.isAffecting(this.note))) {
            this.refresh();
        }
    }
}
