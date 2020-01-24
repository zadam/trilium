import noteDetailService from "../../services/note_detail.js";
import searchNotesService from "../../services/search_notes.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-search note-detail-printable">
    <div style="display: flex; align-items: center; margin-right: 20px; margin-top: 15px;">
        <strong>Search string: &nbsp; &nbsp;</strong>
        <textarea rows="4" style="width: auto !important; flex-grow: 4" class="search-string form-control"></textarea>

        <span>
            &nbsp; &nbsp;
            <button type="button" class="btn btn-primary note-detail-search-refresh-results-button">Refresh search results</button>
        </span>
    </div>

    <br />

    <div class="note-detail-search-help"></div>
</div>`;

export default class SearchTypeWidget extends TypeWidget {
    static getType() { return "search"; }

    doRender() {
        this.$widget = $(TPL);
        this.$searchString = this.$widget.find(".search-string");
        this.$component = this.$widget.find('.note-detail-search');
        this.$help = this.$widget.find(".note-detail-search-help");
        this.$refreshButton = this.$widget.find('.note-detail-search-refresh-results-button');

        this.$refreshButton.on('click', async () => {
            // FIXME
            await noteDetailService.saveNotesIfChanged();

            await searchNotesService.refreshSearch();
        });
        
        return this.$widget;
    }

    doRefresh(note) {
        this.$help.html(searchNotesService.getHelpText());

        this.$component.show();

        try {
            const json = JSON.parse(note.content);

            this.$searchString.val(json.searchString);
        }
        catch (e) {
            console.log(e);
            this.$searchString.val('');
        }

        this.$searchString.on('input', () => this.noteChanged());
    }

    getContent() {
        return JSON.stringify({
            searchString: this.$searchString.val()
        });
    }

    focus() {}

    cleanup() {}

    scrollToTop() {}
}