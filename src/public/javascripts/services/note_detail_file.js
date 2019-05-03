import utils from "./utils.js";
import server from "./server.js";
import protectedSessionHolder from "./protected_session_holder.js";
import noteDetailService from "./note_detail.js";

class NoteDetailFile {
    /**
     * @param {NoteContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$noteTabContent.find('.note-detail-file');
        this.$fileNoteId = ctx.$noteTabContent.find(".file-note-id");
        this.$fileName = ctx.$noteTabContent.find(".file-filename");
        this.$fileType = ctx.$noteTabContent.find(".file-filetype");
        this.$fileSize = ctx.$noteTabContent.find(".file-filesize");
        this.$previewRow = ctx.$noteTabContent.find(".file-preview-row");
        this.$previewContent = ctx.$noteTabContent.find(".file-preview-content");
        this.$downloadButton = ctx.$noteTabContent.find(".file-download");
        this.$openButton = ctx.$noteTabContent.find(".file-open");

        this.$downloadButton.click(() => utils.download(this.getFileUrl()));

        this.$openButton.click(() => {
            if (utils.isElectron()) {
                const open = require("open");

                open(this.getFileUrl());
            }
            else {
                window.location.href = this.getFileUrl();
            }
        });
    }

    async show() {
        const attributes = await server.get('notes/' + this.ctx.note.noteId + '/attributes');
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$component.show();

        this.$fileNoteId.text(this.ctx.note.noteId);
        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text((attributeMap.fileSize || "?") + " bytes");
        this.$fileType.text(this.ctx.note.mime);

        if (this.ctx.note.content) {
            this.$previewRow.show();
            this.$previewContent.text(this.ctx.note.content);
        }
        else {
            this.$previewRow.hide();
        }

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        this.$openButton.toggle(!this.ctx.note.isProtected);
    }

    getFileUrl() {
        // electron needs absolute URL so we extract current host, port, protocol
        return utils.getHost() + "/api/notes/" + this.ctx.note.noteId + "/download";
    }

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {}
}

export default NoteDetailFile;