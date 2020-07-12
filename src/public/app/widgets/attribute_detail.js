import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import BasicWidget from "./basic_widget.js";
import noteAutocompleteService from "../services/note_autocomplete.js";

const TPL = `
<div class="attr-detail" style="display: none;">
    <style>
        .attr-detail {
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
        <h5>Label detail</h5>
        
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
        <tr>
            <th>Inheritable:</th>
            <td><input type="checkbox" class="attr-edit-inheritable form-control form-control-sm" /></td>
        </tr>
    </table>

    <br/>

    <h5 class="related-notes-tile">Other notes with this label</h5>
    
    <ul class="related-notes-list"></ul>
    
    <div class="related-notes-more-notes"></div>
</div>`;


const DISPLAYED_NOTES = 10;

export default class AttributeDetailWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$relatedNotesTitle = this.$widget.find('.related-notes-tile');
        this.$relatedNotesList = this.$widget.find('.related-notes-list');
        this.$relatedNotesMoreNotes = this.$widget.find('.related-notes-more-notes');

        this.$attrEditName = this.$widget.find('.attr-edit-name');
        this.$attrEditName.on('keyup', () => this.updateParent());

        this.$attrValueRow = this.$widget.find('.attr-value-row');
        this.$attrEditValue = this.$widget.find('.attr-edit-value');
        this.$attrEditValue.on('keyup', () => this.updateParent());

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
        this.$closeAttrDetailButton = this.$widget.find('.close-attr-detail-button');
        this.$attrIsOwnedBy = this.$widget.find('.attr-is-owned-by');

        this.$closeAttrDetailButton.on('click', () => this.hide());

        $(window).on('mouseup', e => {
            if (!$(e.target).closest(this.$widget[0]).length
                && !$(e.target).closest(".algolia-autocomplete").length) {
                this.hide();
            }
        });
    }

    async showAttributeDetail({allAttributes, attribute, isOwned, x, y}) {
        if (!attribute) {
            this.hide();

            return;
        }

        this.allAttributes = allAttributes;
        this.attribute = attribute;

        this.toggleInt(true);

        let {results, count} = await server.post('search-related', attribute);

        for (const res of results) {
            res.noteId = res.notePathArray[res.notePathArray.length - 1];
        }

        results = results.filter(({noteId}) => noteId !== this.noteId);

        if (results.length === 0) {
            this.$relatedNotesTitle.hide();
        }
        else {
            this.$relatedNotesTitle.text(`Other notes with ${attribute.type} name "${attribute.name}"`);
        }

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

        this.$attrValueRow.toggle(attribute.type === 'label');
        this.$attrTargetNoteRow.toggle(attribute.type === 'relation');

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

        this.$widget.css("left", x - this.$widget.width() / 2);
        this.$widget.css("top", y + 30);
        this.$widget.show();
    }

    updateParent() {
        this.attribute.name = this.$attrEditName.val();
        this.attribute.value = this.$attrEditValue.val();

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
