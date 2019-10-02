import bundleService from "./bundle.js";
import server from "./server.js";
import linkService from "./link.js";

class NoteDetailBook {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-book');
    }

    async render() {
        this.$component.empty();

        for (const childNote of await this.ctx.note.getChildNotes()) {
            this.$component.append(
                $('<div class="note-book">')
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
        this.$component.empty();
    }

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailBook;