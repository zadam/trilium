import utils from "./utils.js";
import toastService from "./toast.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";

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
        this.$uploadNewRevisionButton = ctx.$tabContent.find(".image-upload-new-revision");
        this.$uploadNewRevisionInput = ctx.$tabContent.find(".image-upload-new-revision-input");
        this.$fileName = ctx.$tabContent.find(".image-filename");
        this.$fileType = ctx.$tabContent.find(".image-filetype");
        this.$fileSize = ctx.$tabContent.find(".image-filesize");

        this.$imageDownloadButton = ctx.$tabContent.find(".image-download");
        this.$imageDownloadButton.on('click', () => utils.download(this.getFileUrl()));

        this.$copyToClipboardButton.on('click',() => {
            this.$imageWrapper.attr('contenteditable','true');

            try {
                this.selectImage(this.$imageWrapper.get(0));

                const success = document.execCommand('copy');

                if (success) {
                    toastService.showMessage("Image copied to the clipboard");
                }
                else {
                    toastService.showAndLogError("Could not copy the image to clipboard.");
                }
            }
            finally {
                window.getSelection().removeAllRanges();
                this.$imageWrapper.removeAttr('contenteditable');
            }
        });

        this.$uploadNewRevisionButton.on("click", () => {
            this.$uploadNewRevisionInput.trigger("click");
        });

        this.$uploadNewRevisionInput.on('change', async () => {
            const formData = new FormData();
            formData.append('upload', this.$uploadNewRevisionInput[0].files[0]);

            const result = await $.ajax({
                url: baseApiUrl + 'images/' + this.ctx.note.noteId,
                headers: server.getHeaders(),
                data: formData,
                type: 'PUT',
                timeout: 60 * 60 * 1000,
                contentType: false, // NEEDED, DON'T REMOVE THIS
                processData: false, // NEEDED, DON'T REMOVE THIS
            });

            if (result.uploaded) {
                toastService.showMessage("New image revision has been uploaded.");

                await utils.clearBrowserCache();

                await noteDetailService.reload();
            }
            else {
                toastService.showError("Upload of a new image revision failed: " + result.message);
            }
        });
    }

    async render() {
        const attributes = await server.get('notes/' + this.ctx.note.noteId + '/attributes');
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$component.show();

        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text(this.ctx.note.contentLength + " bytes");
        this.$fileType.text(this.ctx.note.mime);

        const imageHash = this.ctx.note.utcDateModified.replace(" ", "_");

        this.$imageView.prop("src", `api/images/${this.ctx.note.noteId}/${this.ctx.note.title}?${imageHash}`);
    }

    selectImage(element) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    getFileUrl() {
        return utils.getUrlForDownload(`api/notes/${this.ctx.note.noteId}/download`);
    }

    show() {}

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailImage