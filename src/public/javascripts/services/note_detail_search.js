import noteDetailService from "./note_detail.js";
import searchNotesService from "./search_notes.js";

class NoteDetailSearch {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$searchString = ctx.$tabContent.find(".search-string");
        this.$component = ctx.$tabContent.find('.note-detail-search');
        this.$help = ctx.$tabContent.find(".note-detail-search-help");
        this.$refreshButton = ctx.$tabContent.find('.note-detail-search-refresh-results-button');

        this.$refreshButton.click(async () => {
            await noteDetailService.saveNotesIfChanged();

            await searchNotesService.refreshSearch();
        });
    }

    render() {
        this.$help.html(searchNotesService.getHelpText());

        this.$component.show();

        try {
            const json = JSON.parse(this.ctx.note.content);

            this.$searchString.val(json.searchString);
        }
        catch (e) {
            console.log(e);
            this.$searchString.val('');
        }

        this.$searchString.on('input', () => this.ctx.noteChanged());
    }

    getContent() {
        return JSON.stringify({
            searchString: this.$searchString.val()
        });
    }

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {}
}

export default NoteDetailSearch;