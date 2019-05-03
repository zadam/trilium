import noteDetailService from "./note_detail.js";
import searchNotesService from "./search_notes.js";

class NoteDetailSearch {
    /**
     * @param {NoteContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$searchString = ctx.$noteTabContent.find(".search-string");
        this.$component = ctx.$noteTabContent.find('.note-detail-search');
        this.$help = ctx.$noteTabContent.find(".note-detail-search-help");
        this.$refreshButton = ctx.$noteTabContent.find('.note-detail-search-refresh-results-button');

        this.$refreshButton.click(async () => {
            await noteDetailService.saveNotesIfChanged();

            await searchNotesService.refreshSearch();
        });
    }

    show() {
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

        this.$searchString.on('input', noteDetailService.noteChanged);
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