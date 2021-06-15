import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-book note-detail-printable">
    <style>
    .note-detail-book-auto-help {
        background-color: var(--accented-background-color);
        text-align: center;
        border-radius: 10px;
        padding: 5px;
        margin: 0 10px 10px 10px;
    }
    </style>

    <div class="note-detail-book-empty-help alert alert-warning" style="margin: 50px; padding: 20px;">
        This note of type Book doesn't have any child notes so there's nothing to display. See <a href="https://github.com/zadam/trilium/wiki/Book-note">wiki</a> for details.
    </div>
</div>`;

export default class BookTypeWidget extends TypeWidget {
    static getType() { return "book"; }

    doRender() {
        this.$widget = $(TPL);
        this.$helpNoChildren = this.$widget.find('.note-detail-book-empty-help');

        super.doRender();
    }

    async doRefresh(note) {
        this.$helpNoChildren.toggle(!this.note.hasChildren());
    }
}
