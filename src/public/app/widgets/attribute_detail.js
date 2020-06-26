import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import BasicWidget from "./basic_widget.js";

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
    </style>

    <h5>Label detail</h5>

    <table class="attr-edit">
        <tr>
            <th>Name:</th>
            <td><input type="text" class="attr-edit-name form-control form-control-sm" /></td>
        </tr>
        <tr>
            <th>Value:</th>
            <td><input type="text" class="attr-edit-value form-control form-control-sm" /></td>
        </tr>
        <tr>
            <th>Inheritable:</th>
            <td><input type="checkbox" class="attr-edit-inheritable form-control form-control-sm" /></td>
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
        this.$attrEditValue = this.$widget.find('.attr-edit-value');
        this.$attrEditInheritable = this.$widget.find('.attr-edit-inheritable');

        return this.$widget;
    }

    async showAttributeDetail(attr, x, y) {
        if (!attr) {
            this.hide();

            return;
        }

        this.toggleInt(true);

        let {results, count} = await server.post('search-related', attr);

        for (const res of results) {
            res.noteId = res.notePathArray[res.notePathArray.length - 1];
        }

        results = results.filter(({noteId}) => noteId !== this.noteId);

        if (results.length === 0) {
            this.$relatedNotesTitle.hide();
        }
        else {
            this.$relatedNotesTitle.text(`Other notes with ${attr.type} name "${attr.name}"`);
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

        this.$attrEditName.val(attr.name);
        this.$attrEditValue.val(attr.value);

        this.$widget.css("left", x - this.$widget.width() / 2);
        this.$widget.css("top", y + 30);
        this.$widget.show();
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
