import utils from "../../services/utils.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-file note-detail-printable">
    <style>
        .file-table td {
            overflow-wrap: anywhere;
        }
    </style>

    <table class="file-table">
        <tr>
            <th>Note ID:</th>
            <td class="file-note-id"></td>
            <th>Original file name:</th>
            <td class="file-filename"></td>
        </tr>
        <tr>
            <th>File type:</th>
            <td class="file-filetype"></td>
            <th>File size:</th>
            <td class="file-filesize"></td>
        </tr>
    </table>
    
    <pre class="file-preview-content"></pre>
    
    <iframe class="pdf-preview" style="width: 100%; height: 100%; flex-grow: 100;"></iframe>

    <div style="padding: 10px; display: flex; justify-content: space-evenly;">
        <button class="file-download btn btn-sm btn-primary" type="button">Download</button>
        &nbsp;
        <button class="file-open btn btn-sm btn-primary" type="button">Open</button>
        &nbsp;
        <button class="file-upload-new-revision btn btn-sm btn-primary">Upload new revision</button>
    
        <input type="file" class="file-upload-new-revision-input" style="display: none">
    </div>
</div>`;

export default class FileTypeWidget extends TypeWidget {
    static getType() { return "file"; }

    doRender() {
        this.$widget = $(TPL);
        this.$fileNoteId = this.$widget.find(".file-note-id");
        this.$fileName = this.$widget.find(".file-filename");
        this.$fileType = this.$widget.find(".file-filetype");
        this.$fileSize = this.$widget.find(".file-filesize");
        this.$previewContent = this.$widget.find(".file-preview-content");
        this.$pdfPreview = this.$widget.find(".pdf-preview");
        this.$downloadButton = this.$widget.find(".file-download");
        this.$openButton = this.$widget.find(".file-open");
        this.$uploadNewRevisionButton = this.$widget.find(".file-upload-new-revision");
        this.$uploadNewRevisionInput = this.$widget.find(".file-upload-new-revision-input");

        this.$downloadButton.on('click', () => utils.download(this.getFileUrl()));

        this.$openButton.on('click', () => {
            if (utils.isElectron()) {
                const open = utils.dynamicRequire("open");

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
                url: baseApiUrl + 'notes/' + this.noteId + '/file',
                headers: server.getHeaders(),
                data: formData,
                type: 'PUT',
                timeout: 60 * 60 * 1000,
                contentType: false, // NEEDED, DON'T REMOVE THIS
                processData: false, // NEEDED, DON'T REMOVE THIS
            });

            if (result.uploaded) {
                toastService.showMessage("New file revision has been uploaded.");

                this.refresh();
            }
            else {
                toastService.showError("Upload of a new file revision failed.");
            }
        });

        return this.$widget;
    }

    async doRefresh(note) {
        const attributes = note.getAttributes();
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$widget.show();

        this.$fileNoteId.text(note.noteId);
        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text(note.contentLength + " bytes");
        this.$fileType.text(note.mime);

        const noteComplement = await this.tabContext.getNoteComplement();

        this.$previewContent.empty().hide();
        this.$pdfPreview.attr('src', '').empty().hide();

        if (noteComplement.content) {
            this.$previewContent.show();
            this.$previewContent.text(noteComplement.content);
        }
        else if (note.mime === 'application/pdf' && utils.isElectron()) {
            this.$pdfPreview.show();
            this.$pdfPreview.attr("src", utils.getUrlForDownload("api/notes/" + this.noteId + "/open"));
        }

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        this.$openButton.toggle(!note.isProtected);
    }

    getFileUrl() {
        return utils.getUrlForDownload("api/notes/" + this.noteId + "/download");
    }
}
