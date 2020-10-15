import noteListRenderer from "../../services/note_list_renderer.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-book note-detail-printable">
    <style>
    .note-detail-book {
        height: 100%;
        padding: 0 10px 10px 10px;
        position: relative;
        display: flex;
        flex-direction: column;
    }
    
    .note-book-auto-message {
        background-color: var(--accented-background-color);
        text-align: center;
        width: 100%;
        border-radius: 10px;
        padding: 5px;
        margin-top: 5px;
    }
    
    .note-detail-book-content {
        flex-grow: 1;
        min-height: 0;
    }
    </style>

    <div class="note-detail-book-help alert alert-warning" style="margin: 50px; padding: 20px;">
        This note of type Book doesn't have any child notes so there's nothing to display. See <a href="https://github.com/zadam/trilium/wiki/Book-note">wiki</a> for details.
    </div>

    <div class="note-detail-book-content"></div>
</div>`;

export default class BookTypeWidget extends TypeWidget {
    static getType() { return "book"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find('.note-detail-book-content');
        this.$help = this.$widget.find('.note-detail-book-help');
    }

    async doRefresh(note) {
        this.$content.empty();
        this.$help.hide();

        if (this.isAutoBook()) {
            const $addTextLink = $('<a href="javascript:">here</a>').on('click', () => {
                this.tabContext.autoBookDisabled = true;

                this.triggerEvent('autoBookDisabled', {tabContext: this.tabContext});
            });

            this.$content.append($('<div class="note-book-auto-message"></div>')
                .append(`This note doesn't have any content so we display its children. <br> Click `)
                .append($addTextLink)
                .append(' if you want to add some text.'));
        }

        // const zoomLevel = parseInt(note.getLabelValue('bookZoomLevel')) || this.getDefaultZoomLevel();
        // this.setZoom(zoomLevel);

        this.$content.append(await noteListRenderer.renderList(await note.getChildNotes()));
    }

    /** @return {boolean} true if this is "auto book" activated (empty text note) and not explicit book note */
    isAutoBook() {
        return this.note.type !== 'book';
    }

    getDefaultZoomLevel() {
        if (this.isAutoBook()) {
            const w = this.$widget.width();

            if (w <= 600) {
                return 1;
            } else if (w <= 900) {
                return 2;
            } else if (w <= 1300) {
                return 3;
            } else {
                return 4;
            }
        }
        else {
            return 1;
        }
    }

    cleanup() {
        this.$content.empty();
    }
}
