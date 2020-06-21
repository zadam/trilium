import TabAwareWidget from "./tab_aware_widget.js";
import libraryLoader from "../services/library_loader.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import treeCache from "../services/tree_cache.js";
import server from "../services/server.js";
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
    max-height: 100px;
    overflow: auto;
}

.note-attributes.error .note-attributes-editor {
    border-color: red !important;
}

.attr-extras {
    display: block;
    background-color: var(--accented-background-color);
    border: 1px solid var(--main-border-color);
    border-radius: 4px;
    z-index: 1000;
    padding: 10px;
    position: absolute;
    max-width: 600px;
    max-height: 600px;
    overflow: auto;
}

.attr-extras-list {
    padding-left: 20px;
    margin-top: 10px;
    margin-bottom: 10px;
}

.attr-edit {
    width: 100%;
}

.attr-edit th {
    text-align: left;
}

.attr-edit td input {
    width: 100%;
}
</style>

<div class="attr-extras" style="display: none;">
    <h5>Label detail</h5>

    <table class="attr-edit">
        <tr>
            <th>Name:</th>
            <td><input type="text" class="form-control form-control-sm" /></td>
        </tr>
        <tr>
            <th>Value:</th>
            <td><input type="text" class="form-control form-control-sm" /></td>
        </tr>
        <tr>
            <th>Inheritable:</th>
            <td><input type="checkbox" class="form-control form-control-sm" /></td>
        </tr>
        <tr>
            <td colspan="2">
                <div style="display: flex; justify-content: space-between">
                    <div>
                        <button type="submit" class="btn btn-sm btn-primary">Save</button>
                        <button type="submit" class="btn btn-sm btn-secondary">Cancel</button>
                    </div>
                    
                    <div>
                        <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <br/>

    <h5>Other notes with this label</h5>

    <div class="form-check">
        <input type="checkbox" class="form-check-input" id="match-value-too">
        <label class="form-check-label" for="match-value-too">match value too</label>
    </div>

    <div class="attr-extras-title"></div>
    
    <ul class="attr-extras-list"></ul>
    
    <div class="attr-extras-more-notes"></div>
</div>

<div class="note-attributes-editor" tabindex="200"></div>
</div>
`;

const DISPLAYED_NOTES = 10;

export default class NoteAttributesWidget extends TabAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(() => {
            this.parseAttributes();

            this.$attrExtras.hide();
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

        this.$editor.on('keydown', async e => {
            const keycode = (e.keyCode ? e.keyCode : e.which);

            if (keycode === 13) {
                this.triggerCommand('focusOnDetail', {tabId: this.tabContext.tabId});

                await this.save();
            }

            this.$attrExtras.hide();
        });

        // this.$editor.on('blur', () => {
        //     this.save();
        //
        //     this.$attrExtras.hide();
        // });

        return this.$widget;
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

            return attrs;
        }
        catch (e) {
            this.$widget.attr("title", e.message);
            this.$widget.addClass("error");
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
                    this.$attrExtras.hide();

                    return;
                }

                const searchString = this.formatAttrForSearch(matchedAttr);

                let {count, results} = await server.get('search/' + encodeURIComponent(searchString), {
                    type: matchedAttr.type,
                    name: matchedAttr.name,
                    value: matchedPart === 'value' ? matchedAttr.value : undefined
                });

                for (const res of results) {
                    res.noteId = res.notePathArray[res.notePathArray.length - 1];
                }

                results = results.filter(({noteId}) => noteId !== this.noteId);

                if (results.length === 0) {
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

                this.$attrExtrasTitle.hide();

                this.$attrExtrasList.empty();

                const displayedResults = results.length <= DISPLAYED_NOTES ? results : results.slice(0, DISPLAYED_NOTES);
                const displayedNotes = await treeCache.getNotes(displayedResults.map(res => res.noteId));

                for (const note of displayedNotes) {
                    const notePath = treeService.getSomeNotePath(note);
                    const $noteLink = await linkService.createNoteLink(notePath, {showNotePath: true});

                    this.$attrExtrasList.append(
                        $("<li>").append($noteLink)
                    );
                }

                if (results.length > DISPLAYED_NOTES) {
                    this.$attrExtrasMoreNotes.show().text(`... and ${count - DISPLAYED_NOTES} more.`);
                }
                else {
                    this.$attrExtrasMoreNotes.hide();
                }

                this.$attrExtras.css("left", e.pageX - this.$attrExtras.width() / 2);
                this.$attrExtras.css("top", e.pageY + 30);
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

    formatAttrForSearch(attr) {
        let searchStr = '';

        if (attr.type === 'label') {
            searchStr += '#';
        }
        else if (attr.type === 'relation') {
            searchStr += '~';
        }
        else {
            throw new Error(`Unrecognized attribute type ${JSON.stringify(attr)}`);
        }

        searchStr += attr.name;

        if (attr.value) {
            searchStr += '=';
            searchStr += this.formatValue(attr.value);
        }

        return searchStr;
    }

    async focusOnAttributesEvent({tabId}) {
        if (this.tabContext.tabId === tabId) {
            this.$editor.trigger('focus');
        }
    }
}
