import server from "./server.js";
import linkService from "./link.js";
import utils from "./utils.js";
import treeCache from "./tree_cache.js";
import renderService from "./render.js";

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
        this.$zoomInButton = this.$component.find('.book-zoom-in');
        this.$zoomOutButton = this.$component.find('.book-zoom-out');
        this.setZoom(1);

        this.$zoomInButton.click(() => this.setZoom(this.zoomLevel - 1));
        this.$zoomOutButton.click(() => this.setZoom(this.zoomLevel + 1));

        this.$content.on('click', '.note-book-open-children-button', async ev => {
            const $card = $(ev.target).closest('.note-book-card');
            const noteId = $card.attr('data-note-id');
            const note = await treeCache.getNote(noteId);

            $card.find('.note-book-open-children-button').hide();
            $card.find('.note-book-hide-children-button').show();

            await this.renderIntoElement(note, $card.find('.note-book-children-content'));
        });

        this.$content.on('click', '.note-book-hide-children-button', async ev => {
            const $card = $(ev.target).closest('.note-book-card');

            $card.find('.note-book-open-children-button').show();
            $card.find('.note-book-hide-children-button').hide();

            $card.find('.note-book-children-content').empty();
        });
    }

    setZoom(zoomLevel) {
        this.zoomLevel = zoomLevel;

        this.$zoomInButton.prop("disabled", zoomLevel === MIN_ZOOM_LEVEL);
        this.$zoomOutButton.prop("disabled", zoomLevel === MAX_ZOOM_LEVEL);

        this.$content.find('.note-book-card').css("flex-basis", ZOOMS[zoomLevel].width);
        this.$content.find('.note-book-content').css("max-height", ZOOMS[zoomLevel].height);
    }

    async render() {
        this.$content.empty();

        await this.renderIntoElement(this.ctx.note, this.$content);
    }

    async renderIntoElement(note, $container) {
        for (const childNote of await note.getChildNotes()) {
            const $card = $('<div class="note-book-card">')
                .attr('data-note-id', childNote.noteId)
                .css("flex-basis", ZOOMS[this.zoomLevel].width)
                .addClass("type-" + childNote.type)
                .append($('<h5 class="note-book-title">').append(await linkService.createNoteLink(childNote.noteId, null, false)))
                .append($('<div class="note-book-content">')
                    .css("max-height", ZOOMS[this.zoomLevel].height)
                    .append(await this.getNoteContent(childNote)));

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

    async getNoteContent(note) {
        if (note.type === 'text') {
            const fullNote = await server.get('notes/' + note.noteId);

            const $content = $("<div>").html(fullNote.content);

            if (!fullNote.content.toLowerCase().includes("<img") && $content.text().trim() === "") {
                return "";
            }
            else {
                return $content;
            }
        }
        else if (note.type === 'code') {
            const fullNote = await server.get('notes/' + note.noteId);

            if (fullNote.content.trim() === "") {
                return "";
            }

            return $("<pre>").text(fullNote.content);
        }
        else if (note.type === 'image') {
            return $("<img>").attr("src", `api/images/${note.noteId}/${note.title}`);
        }
        else if (note.type === 'file') {
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

                    open(getFileUrl());
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
        else if (note.type === 'render') {
            const $el = $('<div>');

            await renderService.render(note, $el, this.ctx);

            return $el;
        }
        else {
            return "<em>Content of this note cannot be displayed in the book format</em>";
        }
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