import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-search note-detail-printable">
    <div style="display: flex; align-items: center; margin-right: 20px; margin-top: 15px;">
        <strong>Search string: &nbsp; &nbsp;</strong>
        <textarea rows="4" style="width: auto !important; flex-grow: 4" class="search-string form-control"></textarea>
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

        return this.$widget;
    }

    async doRefresh(note) {
        this.$help.html(window.glob.SEARCH_HELP_TEXT);

        this.$component.show();

        try {
            const noteComplement = await this.tabContext.getNoteComplement();
            const json = JSON.parse(noteComplement.content);

            this.$searchString.val(json.searchString);
        }
        catch (e) {
            console.log(e);
            this.$searchString.val('');
        }

        this.$searchString.on('input', () => this.spacedUpdate.scheduleUpdate());
    }

    getContent() {
        return JSON.stringify({
            searchString: this.$searchString.val()
        });
    }
}