import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import attributeAutocompleteService from "../services/attribute_autocomplete.js";
import noteAutocompleteService from "../services/note_autocomplete.js";
import promotedAttributeDefinitionParser from '../services/promoted_attribute_definition_parser.js';
import TabAwareWidget from "./tab_aware_widget.js";
import SpacedUpdate from "../services/spaced_update.js";

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
            box-shadow: 10px 10px 93px -25px var(--main-text-color);
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
        }
        
        .attr-save-delete-button-container {
            display: flex; 
            margin-top: 15px;
        }
    </style>

    <div style="display: flex; justify-content: space-between;">
        <h5 class="attr-detail-title"></h5>
        
        <span class="bx bx-x close-attr-detail-button"></span>
    </div>

    <div class="attr-is-owned-by"></div>

    <table class="attr-edit-table">
        <tr>
            <th>Name:</th>
            <td><input type="text" class="attr-input-name form-control" /></td>
        </tr>
        <tr class="attr-row-value">
            <th>Value:</th>
            <td><input type="text" class="attr-input-value form-control" /></td>
        </tr>
        <tr class="attr-row-target-note">
            <th>Target note:</th>
            <td>
                <div class="input-group">
                    <input type="text" class="attr-input-target-note form-control" />
                </div>
            </td>
        </tr>
        <tr class="attr-row-promoted">
            <th>Promoted:</th>
            <td><input type="checkbox" class="attr-input-promoted form-control form-control-sm" /></td>
        </tr>
        <tr class="attr-row-multiplicity">
            <th>Multiplicity:</th>
            <td>
                <select class="attr-input-multiplicity form-control">
                  <option value="single">Single value</option>
                  <option value="multi">Multi value</option>
                </select>
            </td>
        </tr>
        <tr class="attr-row-label-type">
            <th>Type:</th>
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
            <th>Precision:</th>
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
            <th>Inverse relation:</th>
            <td>
                <div class="input-group">
                    <input type="text" class="attr-input-inverse-relation form-control" />
                </div>
            </td>
        </tr>
        <tr>
            <th>Inheritable:</th>
            <td><input type="checkbox" class="attr-input-inheritable form-control form-control-sm" /></td>
        </tr>
    </table>

    <div class="attr-save-delete-button-container">
        <button class="btn btn-primary btn-sm attr-save-changes-and-close-button" 
            style="flex-grow: 1; margin-right: 20px">
            Save & close</button>
            
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

export default class AttributeDetailWidget extends TabAwareWidget {
    isEnabled() {
        // this widget is not activated in a standard way
        return false;
    }

    doRender() {
        this.relatedNotesSpacedUpdate = new SpacedUpdate(async () => this.updateRelatedNotes(), 1000);

        this.$widget = $(TPL);

        this.$title = this.$widget.find('.attr-detail-title');

        this.$relatedNotesContainer = this.$widget.find('.related-notes-container');
        this.$relatedNotesTitle = this.$relatedNotesContainer.find('.related-notes-tile');
        this.$relatedNotesList = this.$relatedNotesContainer.find('.related-notes-list');
        this.$relatedNotesMoreNotes = this.$relatedNotesContainer.find('.related-notes-more-notes');

        this.$inputName = this.$widget.find('.attr-input-name');
        this.$inputName.on('keyup', () => this.userEditedAttribute());

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

        noteAutocompleteService.initNoteAutocomplete(this.$inputTargetNote)
            .on('autocomplete:selected', (event, suggestion, dataset) => {
                if (!suggestion.notePath) {
                    return false;
                }

                this.attribute.value = suggestion.notePath;

                this.triggerCommand('updateAttributeList', { attributes: this.allAttributes });
                this.updateRelatedNotes();
            });

        this.$inputInheritable = this.$widget.find('.attr-input-inheritable');
        this.$inputInheritable.on('change', () => this.userEditedAttribute());

        this.$closeAttrDetailButton = this.$widget.find('.close-attr-detail-button');
        this.$attrIsOwnedBy = this.$widget.find('.attr-is-owned-by');

        this.$attrSaveDeleteButtonContainer = this.$widget.find('.attr-save-delete-button-container');

        this.$saveAndCloseButton = this.$widget.find('.attr-save-changes-and-close-button');
        this.$saveAndCloseButton.on('click', async () => {
            await this.triggerCommand('saveAttributes');

            this.hide();
        });

        this.$deleteButton = this.$widget.find('.attr-delete-button');
        this.$deleteButton.on('click', async () => {
            await this.triggerCommand('updateAttributeList', {
                attributes: this.allAttributes.filter(attr => attr !== this.attribute)
            });

            await this.triggerCommand('saveAttributes');

            this.hide();
        });

        this.$closeAttrDetailButton.on('click', () => this.hide());

        $(window).on('mouseup', e => {
            if (!$(e.target).closest(this.$widget[0]).length
                && !$(e.target).closest(".algolia-autocomplete").length) {
                this.hide();
            }
        });
    }

    userEditedAttribute() {
        this.updateAttributeInEditor();
        this.relatedNotesSpacedUpdate.scheduleUpdate();
    }

    async showAttributeDetail({allAttributes, attribute, isOwned, x, y}) {
        if (!attribute) {
            this.hide();

            return;
        }

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
            const targetNote = await treeCache.getNote(attribute.value);

            this.$inputTargetNote
                .attr('readonly', () => !isOwned)
                .val(targetNote ? targetNote.title : "")
                .setSelectedNotePath(attribute.value);
        }

        this.$inputInheritable
            .prop("checked", !!attribute.isInheritable)
            .attr('disabled', () => !isOwned);

        this.toggleInt(true);

        this.$widget.css("left", x - this.$widget.outerWidth() / 2);
        this.$widget.css("top", y + 25);

        // so that the detail window always fits
        this.$widget.css("max-height",
            this.$widget.outerHeight() + y > $(window).height() - 50
                        ? $(window).height() - y - 50
                        : 10000);
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
            const displayedNotes = await treeCache.getNotes(displayedResults.map(res => res.noteId));

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

        if (this.attrType === 'label-definition') {
            attrName = 'label:' + attrName;
        } else if (this.attrType === 'relation-definition') {
            attrName = 'relation:' + attrName;
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
                props.push('precision=' + this.$inputNumberPrecision.val());
            }
        } else if (this.attrType === 'relation-definition' && this.$inputInverseRelation.val().trim().length > 0) {
            props.push("inverse=" + this.$inputInverseRelation.val());
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
            href: '#' + noteId,
            class: 'reference-link',
            'data-note-path': noteId
        });
    }

    async noteSwitched() {
        this.hide();
    }
}
