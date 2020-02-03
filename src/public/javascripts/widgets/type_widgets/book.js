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
    <style>
    .note-detail-book {
        height: 100%;
        padding: 10px;
        position: relative;
    }
    
    .note-detail-book-content {
        display: flex;
        flex-wrap: wrap;
        overflow: auto;
        height: 100%;
        align-content: start;
    }
    
    .note-book-card {
        border-radius: 10px;
        background-color: var(--accented-background-color);
        padding: 15px;
        padding-bottom: 5px;
        margin: 5px;
        margin-left: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
    }
    
    .note-book-card .note-book-card {
        border: 1px solid var(--main-border-color);
    }
    
    .note-book-content {
        overflow: hidden;
    }
    
    .note-book-card.type-image .note-book-content, .note-book-card.type-file .note-book-content, .note-book-card.type-protected-session .note-book-content {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
    }
    
    .note-book-card.type-image .note-book-content img {
        max-width: 100%;
        max-height: 100%;
    }
    
    .note-book-title {
        flex-grow: 0;
    }
    
    .note-book-content {
        flex-grow: 1;
    }
    
    .note-book-auto-message {
        background-color: var(--accented-background-color);
        text-align: center;
        width: 100%;
        border-radius: 10px;
        padding: 5px;
        margin-top: 5px;
    }
    </style>

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

    <div class="note-detail-book-help alert alert-warning">
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

                this.trigger('autoBookDisabled');
            });

            this.$content.append($('<div class="note-book-auto-message"></div>')
                .append(`This note doesn't have any content so we display its children. Click `)
                .append($addTextLink)
                .append(' if you want to add some text.'));
        }

        const zoomLevel = parseInt(await note.getLabelValue('bookZoomLevel')) || this.getDefaultZoomLevel();
        this.setZoom(zoomLevel);

        await this.renderIntoElement(note, this.$content);
    }

    async renderIntoElement(note, $container) {
        const childNotes = await note.getChildNotes();

        if (childNotes.length === 0) {
            this.$help.show();
        }

        for (const childNote of childNotes) {
            if (note.noteId !== this.noteId) {
                // rendering can take a long time and the note might be switched during the rendering
                return;
            }

            const childNotePath = this.notePath + '/' + childNote.noteId;

            const $content = $('<div class="note-book-content">')
                .css("max-height", ZOOMS[this.zoomLevel].height);

            const $card = $('<div class="note-book-card">')
                .attr('data-note-id', childNote.noteId)
                .css("flex-basis", ZOOMS[this.zoomLevel].width)
                .append($('<h5 class="note-book-title">').append(await linkService.createNoteLink(childNotePath,  {showTooltip: false})))
                .append($content);

            try {
                const {type, renderedContent} = await noteContentRenderer.getRenderedContent(childNote);

                $card.addClass("type-" + type);
                $content.append(renderedContent);
            }
            catch (e) {
                console.log(`Caught error while rendering note ${note.noteId} of type ${note.type}: ${e.message}, stack: ${e.stack}`);

                $content.append("rendering error");
            }

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

    getContent() {}

    focus() {}

    cleanup() {
        this.$content.empty();
    }

    scrollToTop() {
        this.$widget.scrollTop(0);
    }
}