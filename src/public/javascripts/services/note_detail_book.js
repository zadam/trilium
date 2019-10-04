import server from "./server.js";
import linkService from "./link.js";
import utils from "./utils.js";

const MIN_ZOOM_LEVEL = 1;
const MAX_ZOOM_LEVEL = 6;

const ZOOMS = {
    1: 100,
    2: 49,
    3: 32,
    4: 24,
    5: 19,
    6: 16
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
    }

    setZoom(zoomLevel) {
        this.zoomLevel = zoomLevel;

        this.$zoomInButton.prop("disabled", zoomLevel === MIN_ZOOM_LEVEL);
        this.$zoomOutButton.prop("disabled", zoomLevel === MAX_ZOOM_LEVEL);

        this.$content.find('.note-book').css("flex-basis", ZOOMS[zoomLevel] + "%");
    }

    async render() {
        this.$content.empty();

        for (const childNote of await this.ctx.note.getChildNotes()) {
            this.$content.append(
                $('<div class="note-book">')
                    .css("flex-basis", ZOOMS[this.zoomLevel] + "%")
                    .addClass("type-" + childNote.type)
                    .append($('<h5 class="note-book-title">').append(await linkService.createNoteLink(childNote.noteId, null, false)))
                    .append($('<div class="note-book-content">').append(await this.getNoteContent(childNote)))
            );
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