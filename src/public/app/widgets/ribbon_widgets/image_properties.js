import server from "../../services/server.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import toastService from "../../services/toast.js";
import openService from "../../services/open.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="image-properties">
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
    
    <div class="no-print" style="display: flex; justify-content: space-evenly; margin: 10px;">
        <button class="image-download btn btn-sm btn-primary" type="button">Download</button>

        <button class="image-open btn btn-sm btn-primary" type="button">Open</button>

        <button class="image-copy-to-clipboard btn btn-sm btn-primary" type="button">Copy to clipboard</button>

        <button class="image-upload-new-revision btn btn-sm btn-primary" type="button">Upload new revision</button>
    </div>

    <input type="file" class="image-upload-new-revision-input" style="display: none">
</div>`;

export default class ImagePropertiesWidget extends NoteContextAwareWidget {
    get name() {
        return "imageProperties";
    }

    get toggleCommand() {
        return "toggleRibbonTabImageProperties";
    }

    isEnabled() {
        return this.note && this.note.type === 'image';
    }

    getTitle(note) {
        return {
            show: this.isEnabled(),
            activate: true,
            title: 'Image',
            icon: 'bx bx-image'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$copyToClipboardButton = this.$widget.find(".image-copy-to-clipboard");
        this.$uploadNewRevisionButton = this.$widget.find(".image-upload-new-revision");
        this.$uploadNewRevisionInput = this.$widget.find(".image-upload-new-revision-input");
        this.$fileName = this.$widget.find(".image-filename");
        this.$fileType = this.$widget.find(".image-filetype");
        this.$fileSize = this.$widget.find(".image-filesize");

        this.$openButton = this.$widget.find(".image-open");
        this.$openButton.on('click', () => openService.openNoteExternally(this.noteId, this.note.mime ));

        this.$imageDownloadButton = this.$widget.find(".image-download");
        this.$imageDownloadButton.on('click', () => openService.downloadFileNote(this.noteId));

        this.$copyToClipboardButton.on('click', () => this.triggerEvent(`copyImageToClipboard`, {ntxId: this.noteContext.ntxId}));

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
                headers: await server.getHeaders(),
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
    }

    async refreshWithNote(note) {
        const attributes = note.getAttributes();
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$widget.show();

        const noteComplement = await this.noteContext.getNoteComplement();

        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text(noteComplement.contentLength + " bytes");
        this.$fileType.text(note.mime);

        const imageHash = utils.randomString(10);
    }
}
