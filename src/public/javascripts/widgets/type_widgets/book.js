import linkService from "../../services/link.js";
import treeCache from "../../services/tree_cache.js";
import noteContentRenderer from "../../services/note_content_renderer.js";
import TypeWidget from "./type_widget.js";

const MIN_ZOOM_LEVEL = 1;
const MAX_ZOOM_LEVEL = 6;

const ZOOMS = {
    1: {
        width: "100%",
        height: "100%"
    },
    2: {
        width: "49%",
        height: "350px"
    },
    3: {
        width: "32%",
        height: "250px"
    },
    4: {
        width: "24%",
        height: "200px"
    },
    5: {
        width: "19%",
        height: "175px"
    },
    6: {
        width: "16%",
        height: "150px"
    }
};

const TPL = `
<div class="note-detail-book note-detail-printable">
    <div class="btn-group floating-button" style="right: 20px; top: 20px;">
        <button type="button"
                class="expand-children-button btn icon-button bx bx-move-vertical"
                title="Expand all children"></button>

        <button type="button"
                class="book-zoom-in-button btn icon-button bx bx-zoom-in"
                title="Zoom In"></button>

        <button type="button"
                class="book-zoom-out-button btn icon-button bx bx-zoom-out"
                title="Zoom Out"></button>
    </div>

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
        this.$zoomInButton = this.$widget.find('.book-zoom-in-button');
        this.$zoomOutButton = this.$widget.find('.book-zoom-out-button');
        this.$expandChildrenButton = this.$widget.find('.expand-children-button');
        this.$help = this.$widget.find('.note-detail-book-help');

        this.$zoomInButton.on('click', () => this.setZoom(this.zoomLevel - 1));
        this.$zoomOutButton.on('click', () => this.setZoom(this.zoomLevel + 1));

        this.$expandChildrenButton.on('click', async () => {
            for (let i = 1; i < 30; i++) { // protection against infinite cycle
                const $unexpandedLinks = this.$content.find('.note-book-open-children-button:visible');

                if ($unexpandedLinks.length === 0) {
                    break;
                }

                for (const link of $unexpandedLinks) {
                    const $card = $(link).closest(".note-book-card");

                    await this.expandCard($card);
                }
            }
        });

        this.$content.on('click', '.note-book-open-children-button', async ev => {
            const $card = $(ev.target).closest('.note-book-card');

            await this.expandCard($card);
        });

        this.$content.on('click', '.note-book-hide-children-button', async ev => {
            const $card = $(ev.target).closest('.note-book-card');

            $card.find('.note-book-open-children-button').show();
            $card.find('.note-book-hide-children-button').hide();

            $card.find('.note-book-children-content').empty();
        });
        
        return this.$widget;
    }

    async expandCard($card) {
        const noteId = $card.attr('data-note-id');
        const note = await treeCache.getNote(noteId);

        $card.find('.note-book-open-children-button').hide();
        $card.find('.note-book-hide-children-button').show();

        await this.renderIntoElement(note, $card.find('.note-book-children-content'));
    }

    setZoom(zoomLevel) {
        if (!(zoomLevel in ZOOMS)) {
            zoomLevel = this.getDefaultZoomLevel();
        }

        this.zoomLevel = zoomLevel;

        this.$zoomInButton.prop("disabled", zoomLevel === MIN_ZOOM_LEVEL);
        this.$zoomOutButton.prop("disabled", zoomLevel === MAX_ZOOM_LEVEL);

        this.$content.find('.note-book-card').css("flex-basis", ZOOMS[zoomLevel].width);
        this.$content.find('.note-book-content').css("max-height", ZOOMS[zoomLevel].height);
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

        const zoomLevel = parseInt(note.getLabelValue('bookZoomLevel')) || this.getDefaultZoomLevel();
        this.setZoom(zoomLevel);

        await this.renderIntoElement(note, this.$content);
    }

    async renderIntoElement(note, $container) {
        const childNotes = await note.getChildNotes();

        if (childNotes.length === 0) {
            this.$help.show();
        }

        const imageLinks = note.getRelations('imageLink');

        for (const childNote of childNotes) {
            // image is already visible in the parent note so no need to display it separately in the book
            if (imageLinks.find(rel => rel.value === childNote.noteId)) {
                continue;
            }

            const $card = await this.renderNote(childNote);

            $container.append($card);
        }
    }

    async renderNote(note) {
        const notePath = this.notePath + '/' + note.noteId;

        const $content = $('<div class="note-book-content">')
            .css("max-height", ZOOMS[this.zoomLevel].height);

        const $card = $('<div class="note-book-card">')
            .attr('data-note-id', note.noteId)
            .css("flex-basis", ZOOMS[this.zoomLevel].width)
            .append($('<h5 class="note-book-title">').append(await linkService.createNoteLink(notePath, {showTooltip: false})))
            .append($content);

        try {
            const {type, renderedContent} = await noteContentRenderer.getRenderedContent(note);

            $card.addClass("type-" + type);
            $content.append(renderedContent);
        } catch (e) {
            console.log(`Caught error while rendering note ${note.noteId} of type ${note.type}: ${e.message}, stack: ${e.stack}`);

            $content.append("rendering error");
        }

        const imageLinks = note.getRelations('imageLink');

        const childCount = note.getChildNoteIds()
            .filter(childNoteId => !imageLinks.find(rel => rel.value === childNoteId))
            .length;

        if (childCount > 0) {
            const label = `${childCount} child${childCount > 1 ? 'ren' : ''}`;

            $card.append($('<div class="note-book-children">')
                .append($(`<a class="note-book-open-children-button no-print" href="javascript:">+ Show ${label}</a>`))
                .append($(`<a class="note-book-hide-children-button no-print" href="javascript:">- Hide ${label}</a>`).hide())
                .append($('<div class="note-book-children-content">'))
            );
        }

        return $card;
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