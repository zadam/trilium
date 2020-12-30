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
    
    <div class="note-detail-book-auto-help">
        This note doesn't have any content so we display its children. 
        <br> Click <a href="javascript:">here</a> if you want to add some text.
    </div>
</div>`;

export default class BookTypeWidget extends TypeWidget {
    static getType() { return "book"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$helpNoChildren = this.$widget.find('.note-detail-book-empty-help');

        this.$helpAutoBook = this.$widget.find('.note-detail-book-auto-help');
        this.$helpAutoBook.find('a').on('click', () => {
            this.tabContext.autoBookDisabled = true;

            this.triggerEvent('autoBookDisabled', {tabContext: this.tabContext});
        });
    }

    async doRefresh(note) {
        this.$helpNoChildren.toggle(!this.note.hasChildren());
        this.$helpAutoBook.toggle(this.note.type !== 'book');
    }
}
