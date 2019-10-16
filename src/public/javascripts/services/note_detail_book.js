import server from "./server.js";
import linkService from "./link.js";
import utils from "./utils.js";
import treeCache from "./tree_cache.js";
import renderService from "./render.js";
import protectedSessionHolder from "./protected_session_holder.js";
import protectedSessionService from "./protected_session.js";

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

        this.$zoomInButton.click(() => this.setZoom(this.zoomLevel - 1));
        this.$zoomOutButton.click(() => this.setZoom(this.zoomLevel + 1));

        this.$expandChildrenButton.click(async () => {
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

        if (this.isAutoBook()) {
            const $addTextLink = $('<a href="javascript:">here</a>').click(() => {
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
        for (const childNote of await note.getChildNotes()) {
            const type = this.getRenderingType(childNote);

            const $card = $('<div class="note-book-card">')
                .attr('data-note-id', childNote.noteId)
                .css("flex-basis", ZOOMS[this.zoomLevel].width)
                .addClass("type-" + type)
                .append($('<h5 class="note-book-title">').append(await linkService.createNoteLink(childNote.noteId, null, false)))
                .append($('<div class="note-book-content">')
                    .css("max-height", ZOOMS[this.zoomLevel].height)
                    .append(await this.getNoteContent(type, childNote)));

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

    async getNoteContent(type, note) {
        if (type === 'text') {
            const fullNote = await server.get('notes/' + note.noteId);

            const $content = $("<div>").html(fullNote.content);

            if (utils.isHtmlEmpty(fullNote.content)) {
                return "";
            }
            else {
                return $content;
            }
        }
        else if (type === 'code') {
            const fullNote = await server.get('notes/' + note.noteId);

            if (fullNote.content.trim() === "") {
                return "";
            }

            return $("<pre>").text(fullNote.content);
        }
        else if (type === 'image') {
            return $("<img>").attr("src", `api/images/${note.noteId}/${note.title}`);
        }
        else if (type === 'file') {
            function getFileUrl() {
                // electron needs absolute URL so we extract current host, port, protocol
                return utils.getHost() + "/api/notes/" + note.noteId + "/download";
            }

            const $downloadButton = $('<button class="file-download btn btn-primary" type="button">Download</button>');
            const $openButton = $('<button class="file-open btn btn-primary" type="button">Open</button>');

            $downloadButton.click(() => utils.download(getFileUrl()));
            $openButton.click(() => {
                if (utils.isElectron()) {
                    const open = require("open");

                    open(getFileUrl(), {url: true});
                }
                else {
                    window.location.href = getFileUrl();
                }
            });

            // open doesn't work for protected notes since it works through browser which isn't in protected session
            $openButton.toggle(!note.isProtected);

            return $('<div>')
                .append($downloadButton)
                .append(' &nbsp; ')
                .append($openButton);
        }
        else if (type === 'render') {
            const $el = $('<div>');

            await renderService.render(note, $el, this.ctx);

            return $el;
        }
        else if (type === 'protected-session') {
            const $button = $(`<button class="btn btn-sm"><span class="jam jam-door"></span> Enter protected session</button>`)
                .click(protectedSessionService.enterProtectedSession);

            return $("<div>")
                .append("<div>This note is protected and to access it you need to enter password.</div>")
                .append("<br/>")
                .append($button);
        }
        else {
            return "<em>Content of this note cannot be displayed in the book format</em>";
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

    getRenderingType(childNote) {
        let type = childNote.type;

        if (childNote.isProtected) {
            if (protectedSessionHolder.isProtectedSessionAvailable()) {
                protectedSessionHolder.touchProtectedSession();
            }
            else {
                type = 'protected-session';
            }
        }

        return type;
    }

    getContent() {}

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