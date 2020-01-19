import utils from "../../services/utils.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";
import noteDetailService from "../../services/note_detail.js";
import TabAwareWidget from "../tab_aware_widget.js";

const TPL = `
<div class="note-detail-file note-detail-component">
    <table class="file-table">
        <tr>
            <th>Note ID:</th>
            <td class="file-note-id"></td>
        </tr>
        <tr>
            <th>Original file name:</th>
            <td class="file-filename"></td>
        </tr>
        <tr>
            <th>File type:</th>
            <td class="file-filetype"></td>
        </tr>
        <tr>
            <th>File size:</th>
            <td class="file-filesize"></td>
        </tr>
        <tr class="file-preview-row">
            <th>Preview:</th>
            <td>
                <pre class="file-preview-content"></pre>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <button class="file-download btn btn-sm btn-primary" type="button">Download</button>
                &nbsp;
                <button class="file-open btn btn-sm btn-primary" type="button">Open</button>
                &nbsp;
                <button class="file-upload-new-revision btn btn-sm btn-primary">Upload new revision</button>
            </td>
        </tr>
    </table>

    <input type="file" class="file-upload-new-revision-input" style="display: none">
</div>`;

class NoteDetailFile extends TabAwareWidget{
    doRender() {
        this.$widget = $(TPL);
        this.$fileNoteId = this.$widget.find(".file-note-id");
        this.$fileName = this.$widget.find(".file-filename");
        this.$fileType = this.$widget.find(".file-filetype");
        this.$fileSize = this.$widget.find(".file-filesize");
        this.$previewRow = this.$widget.find(".file-preview-row");
        this.$previewContent = this.$widget.find(".file-preview-content");
        this.$downloadButton = this.$widget.find(".file-download");
        this.$openButton = this.$widget.find(".file-open");
        this.$uploadNewRevisionButton = this.$widget.find(".file-upload-new-revision");
        this.$uploadNewRevisionInput = this.$widget.find(".file-upload-new-revision-input");

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
                url: baseApiUrl + 'notes/' + this.tabContext.note.noteId + '/file',
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
        
        return this.$widget;
    }

    async refresh() {
        const attributes = await server.get('notes/' + this.tabContext.note.noteId + '/attributes');
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$widget.show();

        this.$fileNoteId.text(this.tabContext.note.noteId);
        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileSize.text(this.tabContext.note.contentLength + " bytes");
        this.$fileType.text(this.tabContext.note.mime);

        if (this.tabContext.note.content) {
            this.$previewRow.show();
            this.$previewContent.text(this.tabContext.note.content);
        }
        else {
            this.$previewRow.hide();
        }

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        this.$openButton.toggle(!this.tabContext.note.isProtected);
    }

    getFileUrl() {
        return utils.getUrlForDownload("api/notes/" + this.tabContext.note.noteId + "/download");
    }

    show() {}

    getContent() {}

    focus() {}

    onNoteChange() {}

    cleanup() {}

    scrollToTop() {}
}

export default NoteDetailFile;