import utils from "../../services/utils.js";
import toastService from "../../services/toast.js";
import server from "../../services/server.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-image note-detail-printable">
    <div class="no-print" style="display: flex; justify-content: space-evenly; margin: 10px;">
        <button class="image-download btn btn-sm btn-primary" type="button">Download</button>

        <button class="image-copy-to-clipboard btn btn-sm btn-primary" type="button">Copy to clipboard</button>

        <button class="image-upload-new-revision btn btn-sm btn-primary" type="button">Upload new revision</button>
    </div>

    <div class="note-detail-image-wrapper">
        <img class="note-detail-image-view" />
    </div>

    <div style="display: flex; justify-content: space-evenly; margin: 10px;">
        <span>
            <strong>Original file name:</strong>
            <span class="image-filename"></span>
        </span>

        <span>
            <strong>File type:</strong>
            <span class="image-filetype"></span>
        </span>

        <span>
            <strong>File size:</strong>
            <span class="image-filesize"></span>
        </span>
    </div>

    <input type="file" class="image-upload-new-revision-input" style="display: none">
</div>`;

class ImageTypeWidget extends TypeWidget {
    static getType() { return "image"; }

    doRender() {
        this.$widget = $(TPL);
        this.$imageWrapper = this.$widget.find('.note-detail-image-wrapper');
        this.$imageView = this.$widget.find('.note-detail-image-view');
        this.$copyToClipboardButton = this.$widget.find(".image-copy-to-clipboard");
        this.$uploadNewRevisionButton = this.$widget.find(".image-upload-new-revision");
        this.$uploadNewRevisionInput = this.$widget.find(".image-upload-new-revision-input");
        this.$fileName = this.$widget.find(".image-filename");
        this.$fileType = this.$widget.find(".image-filetype");
        this.$fileSize = this.$widget.find(".image-filesize");

        this.$imageDownloadButton = this.$widget.find(".image-download");
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
            const fileToUpload = this.$uploadNewRevisionInput[0].files[0]; // copy to allow reset below
            this.$uploadNewRevisionInput.val('');

            const formData = new FormData();
            formData.append('upload', fileToUpload);

            const result = await $.ajax({
                url: baseApiUrl + 'images/' + this.noteId,
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

                this.refresh();
            }
            else {
                toastService.showError("Upload of a new image revision failed: " + result.message);
            }
        });

        return this.$widget;
    }

    async doRefresh(note) {
        const attributes = note.getAttributes();
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$widget.show();

        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text(note.contentLength + " bytes");
        this.$fileType.text(note.mime);

        const imageHash = utils.randomString(10);

        this.$imageView.prop("src", `api/images/${note.noteId}/${note.title}?${imageHash}`);
    }

    selectImage(element) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    getFileUrl() {
        return utils.getUrlForDownload(`api/notes/${this.noteId}/download`);
    }
}

export default ImageTypeWidget