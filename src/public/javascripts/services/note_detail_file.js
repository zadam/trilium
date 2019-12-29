import utils from "./utils.js";
import server from "./server.js";
import toastService from "./toast.js";
import noteDetailService from "./note_detail.js";

class NoteDetailFile {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-file');
        this.$fileNoteId = ctx.$tabContent.find(".file-note-id");
        this.$fileName = ctx.$tabContent.find(".file-filename");
        this.$fileType = ctx.$tabContent.find(".file-filetype");
        this.$fileSize = ctx.$tabContent.find(".file-filesize");
        this.$previewRow = ctx.$tabContent.find(".file-preview-row");
        this.$previewContent = ctx.$tabContent.find(".file-preview-content");
        this.$downloadButton = ctx.$tabContent.find(".file-download");
        this.$openButton = ctx.$tabContent.find(".file-open");
        this.$uploadNewRevisionButton = ctx.$tabContent.find(".file-upload-new-revision");
        this.$uploadNewRevisionInput = ctx.$tabContent.find(".file-upload-new-revision-input");

        this.$downloadButton.on('click', () => utils.download(this.getFileUrl()));

        this.$openButton.on('click', () => {
            if (utils.isElectron()) {
                const open = require("open");

                open(this.getFileUrl(), {url: true});
            }
            else {
                window.location.href = this.getFileUrl();
            }
        });

        this.$uploadNewRevisionButton.on("click", () => {
            this.$uploadNewRevisionInput.trigger("click");
        });

        this.$uploadNewRevisionInput.on('change', async () => {
            const fileToUpload = this.$uploadNewRevisionInput[0].files[0]; // copy to allow reset below
            this.$uploadNewRevisionInput.val('');

            const formData = new FormData();
            formData.append('upload', fileToUpload);

            const result = await $.ajax({
                url: baseApiUrl + 'notes/' + this.ctx.note.noteId + '/file',
                headers: server.getHeaders(),
                data: formData,
                type: 'PUT',
                timeout: 60 * 60 * 1000,
                contentType: false, // NEEDED, DON'T REMOVE THIS
                processData: false, // NEEDED, DON'T REMOVE THIS
            });

            if (result.uploaded) {
                toastService.showMessage("New file revision has been uploaded.");

                await noteDetailService.reload();
            }
            else {
                toastService.showError("Upload of a new file revision failed.");
            }
        });
    }

    async render() {
        const attributes = await server.get('notes/' + this.ctx.note.noteId + '/attributes');
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$component.show();

        this.$fileNoteId.text(this.ctx.note.noteId);
        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text(this.ctx.note.contentLength + " bytes");
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
        return utils.getUrlForDownload("api/notes/" + this.ctx.note.noteId + "/download");
    }

    show() {}

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {}
}

export default NoteDetailFile;