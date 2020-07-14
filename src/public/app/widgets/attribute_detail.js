import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import BasicWidget from "./basic_widget.js";
import noteAutocompleteService from "../services/note_autocomplete.js";

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
            max-width: 600px;
            max-height: 600px;
            overflow: auto;
        }
        
        .related-notes-list {
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
        
        .close-attr-detail-button {
            font-size: x-large;
            cursor: pointer;
        }
    </style>

    <div style="display: flex; justify-content: space-between;">
        <h5 class="attr-detail-title"></h5>
        
        <span class="bx bx-x close-attr-detail-button"></span>
    </div>

    <div class="attr-is-owned-by"></div>

    <table class="attr-edit">
        <tr>
            <th>Name:</th>
            <td><input type="text" class="attr-edit-name form-control form-control-sm" /></td>
        </tr>
        <tr class="attr-value-row">
            <th>Value:</th>
            <td><input type="text" class="attr-edit-value form-control form-control-sm" /></td>
        </tr>
        <tr class="attr-target-note-row">
            <th>Target note:</th>
            <td>
                <div class="input-group">
                    <input type="text" class="attr-edit-target-note form-control" />
                </div>
            </td>
        </tr>
        <tr class="attr-definition-promoted">
            <th>Promoted:</th>
            <td><input type="checkbox" class="attr-edit-inheritable form-control form-control-sm" /></td>
        </tr>
        <tr class="attr-definition-multiplicity">
            <th>Multiplicity:</th>
            <td>
                <select class="form-control">
                  <option>Single value</option>
                  <option>Multi value</option>
                </select>
            </td>
        </tr>
        <tr class="attr-definition-label-type">
            <th>Type:</th>
            <td>
                <select class="form-control">
                  <option>Text</option>
                  <option>Number</option>
                  <option>Boolean</option>
                  <option>Date</option>
                  <option>URL</option>
                </select>
            </td>
        </tr>
        <tr class="attr-definition-inverse-relation">
            <th>Inverse relation:</th>
            <td>
                <div class="input-group">
                    <input type="text" class="form-control" />
                </div>
            </td>
        </tr>
        <tr>
            <th>Inheritable:</th>
            <td><input type="checkbox" class="attr-edit-inheritable form-control form-control-sm" /></td>
        </tr>
    </table>

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

export default class AttributeDetailWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$title = this.$widget.find('.attr-detail-title');

        this.$relatedNotesContainer = this.$widget.find('.related-notes-container');
        this.$relatedNotesTitle = this.$relatedNotesContainer.find('.related-notes-tile');
        this.$relatedNotesList = this.$relatedNotesContainer.find('.related-notes-list');
        this.$relatedNotesMoreNotes = this.$relatedNotesContainer.find('.related-notes-more-notes');

        this.$attrEditName = this.$widget.find('.attr-edit-name');
        this.$attrEditName.on('keyup', () => this.updateParent());

        this.$attrValueRow = this.$widget.find('.attr-value-row');
        this.$attrEditValue = this.$widget.find('.attr-edit-value');
        this.$attrEditValue.on('keyup', () => this.updateParent());

        this.$attrDefinitionPromoted = this.$widget.find('.attr-definition-promoted');
        this.$attrDefinitionMultiplicity = this.$widget.find('.attr-definition-multiplicity');
        this.$attrDefinitionLabelType = this.$widget.find('.attr-definition-label-type');
        this.$attrDefinitionInverseRelation = this.$widget.find('.attr-definition-inverse-relation');

        this.$attrTargetNoteRow = this.$widget.find('.attr-target-note-row');
        this.$attrEditTargetNote = this.$widget.find('.attr-edit-target-note');

        noteAutocompleteService.initNoteAutocomplete(this.$attrEditTargetNote)
            .on('autocomplete:selected', (event, suggestion, dataset) => {
                if (!suggestion.notePath) {
                    return false;
                }

                this.attribute.value = suggestion.notePath;

                this.triggerCommand('updateAttributeList', { attributes: this.allAttributes });
            });

        this.$attrEditInheritable = this.$widget.find('.attr-edit-inheritable');
        this.$attrEditInheritable.on('change', () => this.updateParent());

        this.$closeAttrDetailButton = this.$widget.find('.close-attr-detail-button');
        this.$attrIsOwnedBy = this.$widget.find('.attr-is-owned-by');

        this.$closeAttrDetailButton.on('click', () => this.hide());

        $(window).on('mouseup', e => {
            if (!$(e.target).closest(this.$widget[0]).length
                && !$(e.target).closest(".algolia-autocomplete").length) {
                this.hide();
            }
        });

        this.toggleInt(false); // initial state is hidden
    }

    async showAttributeDetail({allAttributes, attribute, isOwned, x, y}) {
        if (!attribute) {
            this.hide();

            return;
        }

        const attrType = this.getAttrType(attribute);

        this.$title.text(ATTR_TITLES[attrType]);

        this.allAttributes = allAttributes;
        this.attribute = attribute;

        let {results, count} = await server.post('search-related', attribute);

        for (const res of results) {
            res.noteId = res.notePathArray[res.notePathArray.length - 1];
        }

        results = results.filter(({noteId}) => noteId !== this.noteId);

        if (results.length === 0) {
            this.$relatedNotesContainer.hide();
        }
        else {
            this.$relatedNotesContainer.show();
            this.$relatedNotesTitle.text(`Other notes with ${attribute.type} name "${attribute.name}"`);

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
            }
            else {
                this.$relatedNotesMoreNotes.hide();
            }
        }

        if (isOwned) {
            this.$attrIsOwnedBy.hide();
        }
        else {
            this.$attrIsOwnedBy
                .show()
                .append(attribute.type === 'label' ? 'Label' : 'Relation')
                .append(' is owned by note ')
                .append(await linkService.createNoteLink(attribute.noteId))
        }

        this.$attrEditName
            .val(attribute.name)
            .attr('readonly', () => !isOwned);

        this.$attrValueRow.toggle(attrType === 'label');
        this.$attrTargetNoteRow.toggle(attrType === 'relation');

        this.$attrDefinitionPromoted.toggle(['label-definition', 'relation-definition'].includes(attrType));
        this.$attrDefinitionMultiplicity.toggle(['label-definition', 'relation-definition'].includes(attrType));
        this.$attrDefinitionLabelType.toggle(attrType === 'label-definition');
        this.$attrDefinitionInverseRelation.toggle(attrType === 'relation-definition');

        if (attribute.type === 'label') {
            this.$attrEditValue
                .val(attribute.value)
                .attr('readonly', () => !isOwned);
        }
        else if (attribute.type === 'relation') {
            const targetNote = await treeCache.getNote(attribute.value);

            this.$attrEditTargetNote
                .attr('readonly', () => !isOwned)
                .val(targetNote ? targetNote.title : "")
                .setSelectedNotePath(attribute.value);
        }

        this.$attrEditInheritable
            .prop("checked", !!attribute.isInheritable)
            .attr('disabled', () => !isOwned);

        this.toggleInt(true);

        this.$widget.css("left", x - this.$widget.outerWidth() / 2);
        this.$widget.css("top", y + 25);
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

    updateParent() {
        this.attribute.name = this.$attrEditName.val();
        this.attribute.value = this.$attrEditValue.val();
        this.attribute.isInheritable = this.$attrEditInheritable.is(":checked");

        this.triggerCommand('updateAttributeList', { attributes: this.allAttributes });
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
}
