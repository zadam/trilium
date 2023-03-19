import server from "../../services/server.js";
import froca from "../../services/froca.js";
import treeService from "../../services/tree.js";
import linkService from "../../services/link.js";
import attributeAutocompleteService from "../../services/attribute_autocomplete.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";
import promotedAttributeDefinitionParser from '../../services/promoted_attribute_definition_parser.js';
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import SpacedUpdate from "../../services/spaced_update.js";
import utils from "../../services/utils.js";
import shortcutService from "../../services/shortcuts.js";

const TPL = `
<div class="attr-detail">
    <style>
        .attr-detail {
            display: block;
            background-color: var(--accented-background-color);
            border: 1px solid var(--main-border-color);
            border-radius: 4px;
            z-index: 1000;
            padding: 15px;
            position: absolute;
            width: 500px;
            max-height: 600px;
            overflow: auto;
            box-shadow: 10px 10px 93px -25px black;
        }
        
        .attr-help td {
            color: var(--muted-text-color);
            padding: 5px;
        }
        
        .related-notes-list {
            padding-left: 20px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .attr-edit-table {
            width: 100%;
        }
        
        .attr-edit-table th {
            text-align: left;
        }
        
        .attr-edit-table td input {
            width: 100%;
        }
        
        .close-attr-detail-button {
            font-size: x-large;
            cursor: pointer;
            position: relative;
            top: -2px;
        }
        
        .attr-save-delete-button-container {
            display: flex; 
            margin-top: 15px;
        }
        
        .attr-detail input[readonly] {
            background-color: var(--accented-background-color) !important;
        }
    </style>

    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <h5 class="attr-detail-title"></h5>
        
        <span class="bx bx-x close-attr-detail-button" title="Cancel changes and close"></span>
    </div>

    <div class="attr-is-owned-by"></div>

    <table class="attr-edit-table">
        <tr title="Attribute name can be composed of alphanumeric characters, colon and underscore only">
            <th>Name:</th>
            <td><input type="text" class="attr-input-name form-control" /></td>
        </tr>
        <tr class="attr-help"></tr>
        <tr class="attr-row-value">
            <th>Value:</th>
            <td><input type="text" class="attr-input-value form-control" /></td>
        </tr>
        <tr class="attr-row-target-note">
            <th title="Relation is a named connection between source note and target note.">Target note:</th>
            <td>
                <div class="input-group">
                    <input type="text" class="attr-input-target-note form-control" />
                </div>
            </td>
        </tr>
        <tr class="attr-row-promoted"
            title="Promoted attribute is displayed prominently on the note.">
            <th>Promoted:</th>
            <td><input type="checkbox" class="attr-input-promoted form-control form-control-sm" /></td>
        </tr>
        <tr class="attr-row-multiplicity">
            <th title="Multiplicity defines how many attributes of the same name can be created - at max 1 or more than 1.">Multiplicity:</th>
            <td>
                <select class="attr-input-multiplicity form-control">
                  <option value="single">Single value</option>
                  <option value="multi">Multi value</option>
                </select>
            </td>
        </tr>
        <tr class="attr-row-label-type">
            <th title="Type of the label will help Trilium to choose suitable interface to enter the label value.">Type:</th>
            <td>
                <select class="attr-input-label-type form-control">
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                  <option value="url">URL</option>
                </select>
            </td>
        </tr>
        <tr class="attr-row-number-precision">
            <th title="What number of digits after floating point should be available in the value setting interface.">Precision:</th>
            <td>
                <div class="input-group">
                    <input type="number" class="form-control attr-input-number-precision" style="text-align: right">
                    <div class="input-group-append">
                        <span class="input-group-text">digits</span>
                    </div>
                </div>
            </td>
        </tr>
        <tr class="attr-row-inverse-relation">
            <th title="Optional setting to define to which relation is this one opposite. Example: Father - Son are inverse relations to each other.">Inverse relation:</th>
            <td>
                <div class="input-group">
                    <input type="text" class="attr-input-inverse-relation form-control" />
                </div>
            </td>
        </tr>
        <tr title="Inheritable attribute will be inherited to all descendants under this tree.">
            <th>Inheritable:</th>
            <td><input type="checkbox" class="attr-input-inheritable form-control form-control-sm" /></td>
        </tr>
    </table>

    <div class="attr-save-delete-button-container">
        <button class="btn btn-primary btn-sm attr-save-changes-and-close-button" 
            style="flex-grow: 1; margin-right: 20px">
            Save & close <kbd>Ctrl+Enter</kbd></button>
            
        <button class="btn btn-secondary btn-sm attr-delete-button">
            Delete</button>
    </div>

    <div class="related-notes-container">
        <br/>

        <h5 class="related-notes-tile">Other notes with this label</h5>
        
        <ul class="related-notes-list"></ul>
        
        <div class="related-notes-more-notes"></div>
    </div>
</div>`;

const DISPLAYED_NOTES = 10;

const ATTR_TITLES = {
    "label": "Label detail",
    "label-definition": "Label definition detail",
    "relation": "Relation detail",
    "relation-definition": "Relation definition detail"
};

const ATTR_HELP = {
    "label": {
        "disableVersioning": "disables auto-versioning. Useful for e.g. large, but unimportant notes - e.g. large JS libraries used for scripting",
        "calendarRoot": "marks note which should be used as root for day notes. Only one should be marked as such.",
        "archived": "notes with this label won't be visible by default in search results (also in Jump To, Add Link dialogs etc).",
        "excludeFromExport": "notes (with their sub-tree) won't be included in any note export",
        "run": `defines on which events script should run. Possible values are:
                <ul>
                    <li>frontendStartup - when Trilium frontend starts up (or is refreshed).</li>
                    <li>backendStartup - when Trilium backend starts up</li>
                    <li>hourly - run once an hour. You can use additional label <code>runAtHour</code> to specify at which hour.</li>
                    <li>daily - run once a day</li>
                </ul>`,
        "runOnInstance": "Define which trilium instance should run this on. Default to all instances.",
        "runAtHour": "On which hour should this run. Should be used together with <code>#run=hourly</code>. Can be defined multiple times for more runs during the day.",
        "disableInclusion": "scripts with this label won't be included into parent script execution.",
        "sorted": "keeps child notes sorted by title alphabetically",
        "sortDirection": "ASC (the default) or DESC",
        "sortFoldersFirst": "Folders (notes with children) should be sorted on top",
        "top": "keep given note on top in its parent (applies only on sorted parents)",
        "hidePromotedAttributes": "Hide promoted attributes on this note",
        "readOnly": "editor is in read only mode. Works only for text and code notes.",
        "autoReadOnlyDisabled": "text/code notes can be set automatically into read mode when they are too large. You can disable this behavior on per-note basis by adding this label to the note",
        "appCss": "marks CSS notes which are loaded into the Trilium application and can thus be used to modify Trilium's looks.",
        "appTheme": "marks CSS notes which are full Trilium themes and are thus available in Trilium options.",
        "cssClass": "value of this label is then added as CSS class to the node representing given note in the tree. This can be useful for advanced theming. Can be used in template notes.",
        "iconClass": "value of this label is added as a CSS class to the icon on the tree which can help visually distinguish the notes in the tree. Example might be bx bx-home - icons are taken from boxicons. Can be used in template notes.",
        "pageSize": "number of items per page in note listing",
        "customRequestHandler": 'see <a href="javascript:" data-help-page="Custom request handler">Custom request handler</a>',
        "customResourceProvider": 'see <a href="javascript:" data-help-page="Custom request handler">Custom request handler</a>',
        "widget": "marks this note as a custom widget which will be added to the Trilium component tree",
        "workspace": "marks this note as a workspace which allows easy hoisting",
        "workspaceIconClass": "defines box icon CSS class which will be used in tab when hoisted to this note",
        "workspaceTabBackgroundColor": "CSS color used in the note tab when hoisted to this note",
        "workspaceCalendarRoot": "Defines per-workspace calendar root",
        "workspaceTemplate": "This note will appear in the selection of available template when creating new note, but only when hoisted into a workspace containing this template",
        "searchHome": "new search notes will be created as children of this note",
        "workspaceSearchHome": "new search notes will be created as children of this note when hoisted to some ancestor of this workspace note",
        "inbox": "default inbox location for new notes - when you create a note using \"new note\" button in the sidebar, notes will be created as child notes in the note marked as with <code>#inbox</code> label.",
        "workspaceInbox": "default inbox location for new notes when hoisted to some ancestor of this workspace note",
        "sqlConsoleHome": "default location of SQL console notes",
        "bookmarkFolder": "note with this label will appear in bookmarks as folder (allowing access to its children)",
        "shareHiddenFromTree": "this note is hidden from left navigation tree, but still accessible with its URL",
        "shareAlias": "define an alias using which the note will be available under https://your_trilium_host/share/[your_alias]",
        "shareOmitDefaultCss": "default share page CSS will be omitted. Use when you make extensive styling changes.",
        "shareRoot": "marks note which is served on /share root.",
        "shareDescription": "define text to be added to the HTML meta tag for description",
        "shareRaw": "note will be served in its raw format, without HTML wrapper",
        "shareDisallowRobotIndexing": `will forbid robot indexing of this note via <code>X-Robots-Tag: noindex</code> header`,
        "shareCredentials": "require credentials to access this shared note. Value is expected to be in format 'username:password'. Don't forget to make this inheritable to apply to child-notes/images.",
        "shareIndex": "note with this this label will list all roots of shared notes",
        "displayRelations": "comma delimited names of relations which should be displayed. All other ones will be hidden.",
        "hideRelations": "comma delimited names of relations which should be hidden. All other ones will be displayed.",
        "titleTemplate": `default title of notes created as children of this note. The value is evaluated as JavaScript string 
                        and thus can be enriched with dynamic content via the injected <code>now</code> and <code>parentNote</code> variables. Examples:
                        
                        <ul>
                            <li><code>\${parentNote.getLabelValue('authorName')}'s literary works</code></li>
                            <li><code>Log for \${now.format('YYYY-MM-DD HH:mm:ss')}</code></li>
                        </ul>
                        
                        See <a href="https://github.com/zadam/trilium/wiki/Default-note-title">wiki with details</a>, API docs for <a href="https://zadam.github.io/trilium/backend_api/Note.html">parentNote</a> and <a href="https://day.js.org/docs/en/display/format">now</a> for details.`,
        "template": "This note will appear in the selection of available template when creating new note",
        "toc": "<code>#toc</code> or <code>#toc=show</code> will force the Table of Contents to be shown, <code>#toc=hide</code> will force hiding it. If the label doesn't exist, the global setting is observed",
        "color": "defines color of the note in note tree, links etc. Use any valid CSS color value like 'red' or #a13d5f",
        "keyboardShortcut": "Defines a keyboard shortcut which will immediately jump to this note. Example: 'ctrl+alt+e'. Requires frontend reload for the change to take effect.",
        "keepCurrentHoisting": "Opening this link won't change hoisting even if the note is not displayable in the current hoisted subtree.",
        "executeButton": "Title of the button which will execute the current code note",
        "executeDescription": "Longer description of the current code note displayed together with the execute button",
        "excludeFromNoteMap": "Notes with this label will be hidden from the Note Map",
        "newNotesOnTop": "New notes will be created at the top of the parent note, not on the bottom."
    },
    "relation": {
        "runOnNoteCreation": "executes when note is created on backend. Use this relation if you want to run the script for all notes created under a specific subtree. In that case, create it on the subtree root note and make it inheritable. A new note created within the subtree (any depth) will trigger the script.",
        "runOnChildNoteCreation": "executes when new note is created under the note where this relation is defined",
        "runOnNoteTitleChange": "executes when note title is changed (includes note creation as well)",
        "runOnNoteContentChange": "executes when note content is changed (includes note creation as well).",
        "runOnNoteChange": "executes when note is changed (includes note creation as well). Does not include content changes",
        "runOnNoteDeletion": "executes when note is being deleted",
        "runOnBranchCreation": "executes when a branch is created. Branch is a link between parent note and child note and is created e.g. when cloning or moving note.",
        "runOnBranchDeletion": "executes when a branch is deleted. Branch is a link between parent note and child note and is deleted e.g. when moving note (old branch/link is deleted).",
        "runOnAttributeCreation": "executes when new attribute is created for the note which defines this relation",
        "runOnAttributeChange": " executes when the attribute is changed of a note which defines this relation. This is triggered also when the attribute is deleted",
        "template": "note's attributes will be inherited even without a parent-child relationship, note's content and subtree will be added to instance notes if empty. See documentation for details.",
        "inherit": "note's attributes will be inherited even without a parent-child relationship. See template relation for a similar concept. See attribute inheritance in the documentation.",
        "renderNote": 'notes of type "render HTML note" will be rendered using a code note (HTML or script) and it is necessary to point using this relation to which note should be rendered',
        "widget": "target of this relation will be executed and rendered as a widget in the sidebar",
        "shareCss": "CSS note which will be injected into the share page. CSS note must be in the shared sub-tree as well. Consider using 'shareHiddenFromTree' and 'shareOmitDefaultCss' as well.",
        "shareJs": "JavaScript note which will be injected into the share page. JS note must be in the shared sub-tree as well. Consider using 'shareHiddenFromTree'.",
        "shareFavicon": "Favicon note to be set in the shared page. Typically you want to set it to share root and make it inheritable. Favicon note must be in the shared sub-tree as well. Consider using 'shareHiddenFromTree'.",
    }
};

export default class AttributeDetailWidget extends NoteContextAwareWidget {
    async refresh() {
        // switching note/tab should close the widget

        this.hide();
    }

    doRender() {
        this.relatedNotesSpacedUpdate = new SpacedUpdate(async () => this.updateRelatedNotes(), 1000);

        this.$widget = $(TPL);

        shortcutService.bindElShortcut(this.$widget, 'ctrl+return', () => this.saveAndClose());
        shortcutService.bindElShortcut(this.$widget, 'esc', () => this.cancelAndClose());


        this.$title = this.$widget.find('.attr-detail-title');

        this.$inputName = this.$widget.find('.attr-input-name');
        this.$inputName.on('keyup', () => this.userEditedAttribute());
        this.$inputName.on('change', () => this.userEditedAttribute());
        this.$inputName.on('autocomplete:closed', () => this.userEditedAttribute());

        this.$inputName.on('focus', () => {
            attributeAutocompleteService.initAttributeNameAutocomplete({
                $el: this.$inputName,
                attributeType: () => ['relation', 'relation-definition'].includes(this.attrType) ? 'relation' : 'label',
                open: true
            });
        });

        this.$rowValue = this.$widget.find('.attr-row-value');
        this.$inputValue = this.$widget.find('.attr-input-value');
        this.$inputValue.on('keyup', () => this.userEditedAttribute());
        this.$inputValue.on('change', () => this.userEditedAttribute());
        this.$inputValue.on('autocomplete:closed', () => this.userEditedAttribute());
        this.$inputValue.on('focus', () => {
            attributeAutocompleteService.initLabelValueAutocomplete({
                $el: this.$inputValue,
                open: true,
                nameCallback: () => this.$inputName.val()
            });
        });

        this.$rowPromoted = this.$widget.find('.attr-row-promoted');
        this.$inputPromoted = this.$widget.find('.attr-input-promoted');
        this.$inputPromoted.on('change', () => this.userEditedAttribute());

        this.$rowMultiplicity = this.$widget.find('.attr-row-multiplicity');
        this.$inputMultiplicity = this.$widget.find('.attr-input-multiplicity');
        this.$inputMultiplicity.on('change', () => this.userEditedAttribute());

        this.$rowLabelType = this.$widget.find('.attr-row-label-type');
        this.$inputLabelType = this.$widget.find('.attr-input-label-type');
        this.$inputLabelType.on('change', () => this.userEditedAttribute());

        this.$rowNumberPrecision = this.$widget.find('.attr-row-number-precision');
        this.$inputNumberPrecision = this.$widget.find('.attr-input-number-precision');
        this.$inputNumberPrecision.on('change', () => this.userEditedAttribute());

        this.$rowInverseRelation = this.$widget.find('.attr-row-inverse-relation');
        this.$inputInverseRelation = this.$widget.find('.attr-input-inverse-relation');
        this.$inputInverseRelation.on('keyup', () => this.userEditedAttribute());

        this.$rowTargetNote = this.$widget.find('.attr-row-target-note');
        this.$inputTargetNote = this.$widget.find('.attr-input-target-note');

        noteAutocompleteService.initNoteAutocomplete(this.$inputTargetNote, {allowCreatingNotes: true})
            .on('autocomplete:noteselected', (event, suggestion, dataset) => {
                if (!suggestion.notePath) {
                    return false;
                }

                const pathChunks = suggestion.notePath.split('/');

                this.attribute.value = pathChunks[pathChunks.length - 1]; // noteId

                this.triggerCommand('updateAttributeList', { attributes: this.allAttributes });
                this.updateRelatedNotes();
            });

        this.$inputInheritable = this.$widget.find('.attr-input-inheritable');
        this.$inputInheritable.on('change', () => this.userEditedAttribute());

        this.$closeAttrDetailButton = this.$widget.find('.close-attr-detail-button');
        this.$closeAttrDetailButton.on('click', () => this.cancelAndClose());

        this.$attrIsOwnedBy = this.$widget.find('.attr-is-owned-by');

        this.$attrSaveDeleteButtonContainer = this.$widget.find('.attr-save-delete-button-container');

        this.$saveAndCloseButton = this.$widget.find('.attr-save-changes-and-close-button');
        this.$saveAndCloseButton.on('click', () => this.saveAndClose());

        this.$deleteButton = this.$widget.find('.attr-delete-button');
        this.$deleteButton.on('click', async () => {
            await this.triggerCommand('updateAttributeList', {
                attributes: this.allAttributes.filter(attr => attr !== this.attribute)
            });

            await this.triggerCommand('saveAttributes');

            this.hide();
        });

        this.$attrHelp = this.$widget.find('.attr-help');

        this.$relatedNotesContainer = this.$widget.find('.related-notes-container');
        this.$relatedNotesTitle = this.$relatedNotesContainer.find('.related-notes-tile');
        this.$relatedNotesList = this.$relatedNotesContainer.find('.related-notes-list');
        this.$relatedNotesMoreNotes = this.$relatedNotesContainer.find('.related-notes-more-notes');

        $(window).on('mousedown', e => {
            if (!$(e.target).closest(this.$widget[0]).length
                && !$(e.target).closest(".algolia-autocomplete").length
                && !$(e.target).closest("#context-menu-container").length) {
                this.hide();
            }
        });
    }

    async showAttributeDetail({allAttributes, attribute, isOwned, x, y, focus}) {
        if (!attribute) {
            this.hide();

            return;
        }

        utils.saveFocusedElement();

        this.attrType = this.getAttrType(attribute);

        const attrName =
            this.attrType === 'label-definition' ? attribute.name.substr(6)
                : (this.attrType === 'relation-definition' ? attribute.name.substr(9) : attribute.name);

        const definition = this.attrType.endsWith('-definition')
            ? promotedAttributeDefinitionParser.parse(attribute.value)
            : {};

        this.$title.text(ATTR_TITLES[this.attrType]);

        this.allAttributes = allAttributes;
        this.attribute = attribute;

        // can be slightly slower so just make it async
        this.updateRelatedNotes();

        this.$attrSaveDeleteButtonContainer.toggle(!!isOwned);

        if (isOwned) {
            this.$attrIsOwnedBy.hide();
        }
        else {
            this.$attrIsOwnedBy
                .show()
                .empty()
                .append(attribute.type === 'label' ? 'Label' : 'Relation')
                .append(' is owned by note ')
                .append(await linkService.createNoteLink(attribute.noteId))
        }

        this.$inputName
            .val(attrName)
            .attr('readonly', () => !isOwned);

        this.$rowValue.toggle(this.attrType === 'label');
        this.$rowTargetNote.toggle(this.attrType === 'relation');

        this.$rowPromoted.toggle(['label-definition', 'relation-definition'].includes(this.attrType));
        this.$inputPromoted
            .prop("checked", !!definition.isPromoted)
            .attr('disabled', () => !isOwned);

        this.$rowMultiplicity.toggle(['label-definition', 'relation-definition'].includes(this.attrType));
        this.$inputMultiplicity
            .val(definition.multiplicity)
            .attr('disabled', () => !isOwned);

        this.$rowLabelType.toggle(this.attrType === 'label-definition');
        this.$inputLabelType
            .val(definition.labelType)
            .attr('disabled', () => !isOwned);

        this.$rowNumberPrecision.toggle(this.attrType === 'label-definition' && definition.labelType === 'number');
        this.$inputNumberPrecision
            .val(definition.numberPrecision)
            .attr('disabled', () => !isOwned);

        this.$rowInverseRelation.toggle(this.attrType === 'relation-definition');
        this.$inputInverseRelation
            .val(definition.inverseRelation)
            .attr('disabled', () => !isOwned);

        if (attribute.type === 'label') {
            this.$inputValue
                .val(attribute.value)
                .attr('readonly', () => !isOwned);
        }
        else if (attribute.type === 'relation') {
            this.$inputTargetNote
                .attr('readonly', () => !isOwned)
                .val("")
                .setSelectedNotePath("");

            if (attribute.value) {
                const targetNote = await froca.getNote(attribute.value);

                if (targetNote) {
                    this.$inputTargetNote
                        .val(targetNote ? targetNote.title : "")
                        .setSelectedNotePath(attribute.value);
                }
            }
        }

        this.$inputInheritable
            .prop("checked", !!attribute.isInheritable)
            .attr('disabled', () => !isOwned);

        this.updateHelp();

        this.toggleInt(true);

        const offset = this.parent.$widget.offset();
        const detPosition = this.getDetailPosition(x, offset);

        this.$widget
            .css("left", detPosition.left)
            .css("right", detPosition.right)
            .css("top", y - offset.top + 70)
            .css("max-height",
                this.$widget.outerHeight() + y > $(window).height() - 50
                    ? $(window).height() - y - 50
                    : 10000);

        if (focus === 'name') {
            this.$inputName
                .trigger('focus')
                .trigger('select');
        }
    }

    getDetailPosition(x, offset) {
        let left = x - offset.left - this.$widget.outerWidth() / 2;
        let right = "";

        if (left < 0) {
            left = 10;
        } else {
            const rightEdge = left + this.$widget.outerWidth();

            if (rightEdge > this.parent.$widget.outerWidth() - 10) {
                left = "";
                right = 10;
            }
        }

        return {left, right};
    }

    async saveAndClose() {
        await this.triggerCommand('saveAttributes');

        this.hide();

        utils.focusSavedElement();
    }

    async cancelAndClose() {
        await this.triggerCommand('reloadAttributes');

        this.hide();

        utils.focusSavedElement();
    }

    userEditedAttribute() {
        this.updateAttributeInEditor();
        this.updateHelp();
        this.relatedNotesSpacedUpdate.scheduleUpdate();
    }

    updateHelp() {
        const attrName = this.$inputName.val();

        if (this.attrType in ATTR_HELP && attrName in ATTR_HELP[this.attrType]) {
            this.$attrHelp
                .empty()
                .append($("<td colspan=2>")
                    .append($("<strong>").text(attrName))
                    .append(" - ")
                    .append(ATTR_HELP[this.attrType][attrName])
                )
                .show();
        }
        else {
            this.$attrHelp.empty().hide();
        }
    }

    async updateRelatedNotes() {
        let {results, count} = await server.post('search-related', this.attribute);

        for (const res of results) {
            res.noteId = res.notePathArray[res.notePathArray.length - 1];
        }

        results = results.filter(({noteId}) => noteId !== this.noteId);

        if (results.length === 0) {
            this.$relatedNotesContainer.hide();
        } else {
            this.$relatedNotesContainer.show();
            this.$relatedNotesTitle.text(`Other notes with ${this.attribute.type} name "${this.attribute.name}"`);

            this.$relatedNotesList.empty();

            const displayedResults = results.length <= DISPLAYED_NOTES ? results : results.slice(0, DISPLAYED_NOTES);
            const displayedNotes = await froca.getNotes(displayedResults.map(res => res.noteId));

            for (const note of displayedNotes) {
                const notePath = treeService.getSomeNotePath(note);
                const $noteLink = await linkService.createNoteLink(notePath, {showNotePath: true});

                this.$relatedNotesList.append(
                    $("<li>").append($noteLink)
                );
            }

            if (results.length > DISPLAYED_NOTES) {
                this.$relatedNotesMoreNotes.show().text(`... and ${count - DISPLAYED_NOTES} more.`);
            } else {
                this.$relatedNotesMoreNotes.hide();
            }
        }
    }

    getAttrType(attribute) {
        if (attribute.type === 'label') {
            if (attribute.name.startsWith('label:')) {
                return "label-definition";
            } else if (attribute.name.startsWith('relation:')) {
                return "relation-definition";
            } else {
                return "label";
            }
        }
        else if (attribute.type === 'relation') {
            return "relation";
        }
        else {
            this.$title.text('');
        }
    }

    updateAttributeInEditor() {
        let attrName = this.$inputName.val();

        if (!utils.isValidAttributeName(attrName)) {
            // invalid characters are simply ignored (from user perspective they are not even entered)
            attrName = utils.filterAttributeName(attrName);

            this.$inputName.val(attrName);
        }

        if (this.attrType === 'label-definition') {
            attrName = `label:${attrName}`;
        } else if (this.attrType === 'relation-definition') {
            attrName = `relation:${attrName}`;
        }

        this.attribute.name = attrName;
        this.attribute.isInheritable = this.$inputInheritable.is(":checked");

        if (this.attrType.endsWith('-definition')) {
            this.attribute.value = this.buildDefinitionValue();
        }
        else if (this.attrType === 'relation') {
            this.attribute.value = this.$inputTargetNote.getSelectedNoteId();
        }
        else {
            this.attribute.value = this.$inputValue.val();
        }

        this.triggerCommand('updateAttributeList', { attributes: this.allAttributes });
    }

    buildDefinitionValue() {
        const props = [];

        if (this.$inputPromoted.is(":checked")) {
            props.push("promoted");
        }

        props.push(this.$inputMultiplicity.val());

        if (this.attrType === 'label-definition') {
            props.push(this.$inputLabelType.val());

            if (this.$inputLabelType.val() === 'number' && this.$inputNumberPrecision.val() !== '') {
                props.push(`precision=${this.$inputNumberPrecision.val()}`);
            }
        } else if (this.attrType === 'relation-definition' && this.$inputInverseRelation.val().trim().length > 0) {
            const inverseRelationName = this.$inputInverseRelation.val();

            props.push(`inverse=${utils.filterAttributeName(inverseRelationName)}`);
        }

        this.$rowNumberPrecision.toggle(
            this.attrType === 'label-definition'
            && this.$inputLabelType.val() === 'number');

        return props.join(",");
    }

    hide() {
        this.toggleInt(false);
    }

    createNoteLink(noteId) {
        return $("<a>", {
            href: `#${noteId}`,
            class: 'reference-link',
            'data-note-path': noteId
        });
    }

    async noteSwitched() {
        this.hide();
    }
}
