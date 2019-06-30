import utils from "./utils.js";
import infoService from "./info.js";
import server from "./server.js";

class NoteDetailImage {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-image');
        this.$imageWrapper = ctx.$tabContent.find('.note-detail-image-wrapper');
        this.$imageView = ctx.$tabContent.find('.note-detail-image-view');
        this.$copyToClipboardButton = ctx.$tabContent.find(".image-copy-to-clipboard");
        this.$fileName = ctx.$tabContent.find(".image-filename");
        this.$fileType = ctx.$tabContent.find(".image-filetype");
        this.$fileSize = ctx.$tabContent.find(".image-filesize");

        this.$imageDownloadButton = ctx.$tabContent.find(".image-download");
        this.$imageDownloadButton.click(() => utils.download(this.getFileUrl()));

        this.$copyToClipboardButton.click(() => {
            this.$imageWrapper.attr('contenteditable','true');

            try {
                this.selectImage(this.$imageWrapper.get(0));

                const success = document.execCommand('copy');

                if (success) {
                    infoService.showMessage("Image copied to the clipboard");
                }
                else {
                    infoService.showAndLogError("Could not copy the image to clipboard.");
                }
            }
            finally {
                window.getSelection().removeAllRanges();
                this.$imageWrapper.removeAttr('contenteditable');
            }
        });
    }

    async render() {
        const attributes = await server.get('notes/' + this.ctx.note.noteId + '/attributes');
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$component.show();

        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text((attributeMap.fileSize || "?") + " bytes");
        this.$fileType.text(this.ctx.note.mime);

        this.$imageView.prop("src", `api/images/${this.ctx.note.noteId}/${this.ctx.note.title}`);
    }

    selectImage(element) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    getFileUrl() {
        // electron needs absolute URL so we extract current host, port, protocol
        return utils.getHost() + `/api/notes/${this.ctx.note.noteId}/download`;
    }

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailImage