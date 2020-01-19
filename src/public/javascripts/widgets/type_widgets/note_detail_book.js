import linkService from "../../services/link.js";
import treeCache from "../../services/tree_cache.js";
import noteContentRenderer from "../../services/note_content_renderer.js";

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

class NoteDetailBook {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-book');
        this.$content = this.$component.find('.note-detail-book-content');
        this.$zoomInButton = this.$component.find('.book-zoom-in-button');
        this.$zoomOutButton = this.$component.find('.book-zoom-out-button');
        this.$expandChildrenButton = this.$component.find('.expand-children-button');
        this.$help = this.$component.find('.note-detail-book-help');

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

    async render() {
        this.$content.empty();
        this.$help.hide();

        if (this.isAutoBook()) {
            const $addTextLink = $('<a href="javascript:">here</a>').on('click', () => {
                this.ctx.renderComponent(true);
            });

            this.$content.append($('<div class="note-book-auto-message"></div>')
                .append(`This note doesn't have any content so we display its children. Click `)
                .append($addTextLink)
                .append(' if you want to add some text.'))
        }

        const zoomLevel = parseInt(await this.ctx.note.getLabelValue('bookZoomLevel')) || this.getDefaultZoomLevel();
        this.setZoom(zoomLevel);

        await this.renderIntoElement(this.ctx.note, this.$content);
    }

    async renderIntoElement(note, $container) {
        const childNotes = await note.getChildNotes();

        for (const childNote of childNotes) {
            const childNotePath = this.ctx.notePath + '/' + childNote.noteId;

            const {type, renderedContent} = await noteContentRenderer.getRenderedContent(childNote);

            const $card = $('<div class="note-book-card">')
                .attr('data-note-id', childNote.noteId)
                .css("flex-basis", ZOOMS[this.zoomLevel].width)
                .addClass("type-" + type)
                .append($('<h5 class="note-book-title">').append(await linkService.createNoteLink(childNotePath,  {showTooltip: false})))
                .append($('<div class="note-book-content">')
                    .css("max-height", ZOOMS[this.zoomLevel].height)
                    .append(renderedContent));

            const childCount = childNote.getChildNoteIds().length;

            if (childCount > 0) {
                const label = `${childCount} child${childCount > 1 ? 'ren' : ''}`;

                $card.append($('<div class="note-book-children">')
                    .append($(`<a class="note-book-open-children-button" href="javascript:">+ Show ${label}</a>`))
                    .append($(`<a class="note-book-hide-children-button" href="javascript:">- Hide ${label}</a>`).hide())
                    .append($('<div class="note-book-children-content">'))
                );
            }

            $container.append($card);
        }

        if (childNotes.length === 0) {
            this.$help.show();
        }
    }

    /** @return {boolean} true if this is "auto book" activated (empty text note) and not explicit book note */
    isAutoBook() {
        return this.ctx.note.type !== 'book';
    }

    getDefaultZoomLevel() {
        if (this.isAutoBook()) {
            const w = this.$component.width();

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

    getContent() {
        // for auto-book cases when renaming title there should be content
        return "";
    }

    show() {
        this.$component.show();
    }

    focus() {}

    onNoteChange() {}

    cleanup() {
        this.$content.empty();
    }

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailBook;