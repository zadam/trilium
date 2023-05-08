import utils from '../../services/utils.js';
import treeService from "../../services/tree.js";
import importService from "../../services/import.js";
import options from "../../services/options.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="upload-attachments-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Upload attachments to note</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="upload-attachment-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="upload-attachment-file-upload-input"><strong>Choose files</strong></label>

                        <input type="file" class="upload-attachment-file-upload-input form-control-file" multiple />

                        <p>Files will be uploaded as attachments into <strong class="upload-attachment-note-title"></strong>.
                    </div>

                    <div class="form-group">
                        <strong>Options:</strong>

                        <div class="checkbox">
                            <label data-toggle="tooltip" title="<p>If you check this option, Trilium will attempt to shrink the uploaded images by scaling and optimization which may affect the perceived image quality. If unchecked, images will be uploaded without changes.</p>">
                                <input class="shrink-images-checkbox" value="1" type="checkbox" checked> <span>Shrink images</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="upload-attachment-button btn btn-primary">Upload</button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class UploadAttachmentsDialog extends BasicWidget {
    constructor() {
        super();

        this.parentNoteId = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".upload-attachment-form");
        this.$noteTitle = this.$widget.find(".upload-attachment-note-title");
        this.$fileUploadInput = this.$widget.find(".upload-attachment-file-upload-input");
        this.$uploadButton = this.$widget.find(".upload-attachment-button");
        this.$shrinkImagesCheckbox = this.$widget.find(".shrink-images-checkbox");

        this.$form.on('submit', () => {
            // disabling so that import is not triggered again.
            this.$uploadButton.attr("disabled", "disabled");

            this.uploadAttachments(this.parentNoteId);

            return false;
        });

        this.$fileUploadInput.on('change', () => {
            if (this.$fileUploadInput.val()) {
                this.$uploadButton.removeAttr("disabled");
            }
            else {
                this.$uploadButton.attr("disabled", "disabled");
            }
        });

        this.$widget.find('[data-toggle="tooltip"]').tooltip({
            html: true
        });
    }

    async showUploadAttachmentsDialogEvent({noteId}) {
        this.parentNoteId = noteId;

        this.$fileUploadInput.val('').trigger('change'); // to trigger upload button disabling listener below
        this.$shrinkImagesCheckbox.prop("checked", options.is('compressImages'));

        this.$noteTitle.text(await treeService.getNoteTitle(this.parentNoteId));

        utils.openDialog(this.$widget);
    }

    async uploadAttachments(parentNoteId) {
        const files = Array.from(this.$fileUploadInput[0].files); // shallow copy since we're resetting the upload button below

        const boolToString = $el => $el.is(":checked") ? "true" : "false";

        const options = {
            shrinkImages: boolToString(this.$shrinkImagesCheckbox),
        };

        this.$widget.modal('hide');

        await importService.uploadFiles('attachments', parentNoteId, files, options);
    }
}
