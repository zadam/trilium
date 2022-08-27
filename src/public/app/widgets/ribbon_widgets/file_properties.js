import server from "../../services/server.js";
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import toastService from "../../services/toast.js";
import openService from "../../services/open.js";
import utils from "../../services/utils.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";

const TPL = `
<div class="file-properties-widget">
    <style> 
        .file-table {
            width: 100%;
            margin-top: 10px;
        }
        
        .file-table th, .file-table td {
            padding: 5px;
            overflow-wrap: anywhere;
        }
        
        .file-buttons {
            padding: 10px; 
            display: flex; 
            justify-content: space-evenly;
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
        
        <tr>
            <td colspan="4">
                <div class="file-buttons">
                    <button class="file-download btn btn-sm btn-primary" type="button">Download</button>
                    &nbsp;
                    <button class="file-open btn btn-sm btn-primary" type="button">Open</button>
                    &nbsp;
                    <button class="file-upload-new-revision btn btn-sm btn-primary">Upload new revision</button>
                
                    <input type="file" class="file-upload-new-revision-input" style="display: none">
                </div>
            </td>
        </tr>
    </table>
</div>`;

export default class FilePropertiesWidget extends NoteContextAwareWidget {
    get name() {
        return "fileProperties";
    }

    get toggleCommand() {
        return "toggleRibbonTabFileProperties";
    }

    isEnabled() {
        return this.note && this.note.type === 'file';
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            activate: true,
            title: 'File',
            icon: 'bx bx-file'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$fileNoteId = this.$widget.find(".file-note-id");
        this.$fileName = this.$widget.find(".file-filename");
        this.$fileType = this.$widget.find(".file-filetype");
        this.$fileSize = this.$widget.find(".file-filesize");
        this.$downloadButton = this.$widget.find(".file-download");
        this.$openButton = this.$widget.find(".file-open");
        this.$uploadNewRevisionButton = this.$widget.find(".file-upload-new-revision");
        this.$uploadNewRevisionInput = this.$widget.find(".file-upload-new-revision-input");

        this.$downloadButton.on('click', () => openService.downloadFileNote(this.noteId));
        this.$openButton.on('click', () => openService.openNoteExternally(this.noteId));

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
                headers: await server.getHeaders(),
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
    }

    async refreshWithNote(note) {
        const attributes = note.getAttributes();
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$widget.show();

        this.$fileNoteId.text(note.noteId);
        this.$fileName.text(attributeMap.originalFileName || "?");
        this.$fileType.text(note.mime);

        const noteComplement = await this.noteContext.getNoteComplement();

        this.$fileSize.text(noteComplement.contentLength + " bytes");

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        this.$openButton.toggle(!note.isProtected);
        this.$downloadButton.toggle(!note.isProtected || protectedSessionHolder.isProtectedSessionAvailable())
        this.$uploadNewRevisionButton.toggle(!note.isProtected || protectedSessionHolder.isProtectedSessionAvailable())
    }
}
