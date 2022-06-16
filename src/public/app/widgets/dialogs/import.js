import utils from '../../services/utils.js';
import treeService from "../../services/tree.js";
import importService from "../../services/import.js";
import options from "../../services/options.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="import-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Import into note</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="import-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="import-file-upload-input"><strong>Choose import file</strong></label>

                        <input type="file" class="import-file-upload-input form-control-file" multiple />

                        <p>Content of the file will be imported as child note(s) into <strong class="import-note-title"></strong>.
                    </div>

                    <div class="form-group">
                        <strong>Options:</strong>

                        <div class="checkbox">
                            <label data-toggle="tooltip" title="Trilium <code>.zip</code> export files can contain executable scripts which may contain harmful behavior. Safe import will deactivate automatic execution of all imported scripts. Uncheck &quot;Safe import&quot; only if the imported tar archive is supposed to contain executable scripts and you completely trust the contents of the import file.">
                                <input class="safe-import-checkbox" value="1" type="checkbox" checked>
                                <span>Safe import</span>
                            </label>
                        </div>

                        <div class="checkbox">
                            <label data-toggle="tooltip" title="If this is checked then Trilium will read <code>.zip</code>, <code>.enex</code> and <code>.opml</code> files and create notes from files insides those archives. If unchecked, then Trilium will attach the archives themselves to the note.">
                                <input class="explode-archives-checkbox" value="1" type="checkbox" checked>
                                <span>Read contents of <code>.zip</code>, <code>.enex</code> and <code>.opml</code> archives.</span>
                            </label>
                        </div>

                        <div class="checkbox">
                            <label data-toggle="tooltip" title="<p>If you check this option, Trilium will attempt to shrink the imported images by scaling and optimization which may affect the perceived image quality. If unchecked, images will be imported without changes.</p><p>This doesn't apply to <code>.zip</code> imports with metadata since it is assumed these files are already optimized.</p>">
                                <input class="shrink-images-checkbox" value="1" type="checkbox" checked> <span>Shrink images</span>
                            </label>
                        </div>

                        <div class="checkbox">
                            <label>
                                <input class="text-imported-as-text-checkbox" value="1" type="checkbox" checked>

                                Import HTML, Markdown and TXT as text notes if it's unclear from metadata
                            </label>
                        </div>

                        <div class="checkbox">
                            <label>
                                <input class="code-imported-as-code-checkbox" value="1" type="checkbox" checked> Import recognized code files (e.g. <code>.json</code>) as code notes if it's unclear from metadata
                            </label>
                        </div>

                        <div class="checkbox">
                            <label>
                                <input class="replace-underscores-with-spaces-checkbox" value="1" type="checkbox" checked>

                                Replace underscores with spaces in imported note names
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="import-button btn btn-primary">Import</button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class ImportDialog extends BasicWidget {
    constructor() {
        super();

        this.parentNoteId = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".import-form");
        this.$noteTitle = this.$widget.find(".import-note-title");
        this.$fileUploadInput = this.$widget.find(".import-file-upload-input");
        this.$importButton = this.$widget.find(".import-button");
        this.$safeImportCheckbox = this.$widget.find(".safe-import-checkbox");
        this.$shrinkImagesCheckbox = this.$widget.find(".shrink-images-checkbox");
        this.$textImportedAsTextCheckbox = this.$widget.find(".text-imported-as-text-checkbox");
        this.$codeImportedAsCodeCheckbox = this.$widget.find(".code-imported-as-code-checkbox");
        this.$explodeArchivesCheckbox = this.$widget.find(".explode-archives-checkbox");
        this.$replaceUnderscoresWithSpacesCheckbox = this.$widget.find(".replace-underscores-with-spaces-checkbox");

        this.$form.on('submit', () => {
            // disabling so that import is not triggered again.
            this.$importButton.attr("disabled", "disabled");

            this.importIntoNote(this.parentNoteId);

            return false;
        });

        this.$fileUploadInput.on('change', () => {
            if (this.$fileUploadInput.val()) {
                this.$importButton.removeAttr("disabled");
            }
            else {
                this.$importButton.attr("disabled", "disabled");
            }
        });
    }

    async showImportDialogEvent({noteId}) {
        this.parentNoteId = noteId;

        this.$fileUploadInput.val('').trigger('change'); // to trigger Import button disabling listener below

        this.$safeImportCheckbox.prop("checked", true);
        this.$shrinkImagesCheckbox.prop("checked", options.is('compressImages'));
        this.$textImportedAsTextCheckbox.prop("checked", true);
        this.$codeImportedAsCodeCheckbox.prop("checked", true);
        this.$explodeArchivesCheckbox.prop("checked", true);
        this.$replaceUnderscoresWithSpacesCheckbox.prop("checked", true);

        this.$noteTitle.text(await treeService.getNoteTitle(this.parentNoteId));

        utils.openDialog(this.$widget);
    }

    async importIntoNote(parentNoteId) {
        const files = Array.from(this.$fileUploadInput[0].files); // shallow copy since we're resetting the upload button below

        const boolToString = $el => $el.is(":checked") ? "true" : "false";

        const options = {
            safeImport: boolToString(this.$safeImportCheckbox),
            shrinkImages: boolToString(this.$shrinkImagesCheckbox),
            textImportedAsText: boolToString(this.$textImportedAsTextCheckbox),
            codeImportedAsCode: boolToString(this.$codeImportedAsCodeCheckbox),
            explodeArchives: boolToString(this.$explodeArchivesCheckbox),
            replaceUnderscoresWithSpaces: boolToString(this.$replaceUnderscoresWithSpacesCheckbox)
        };

        this.$widget.modal('hide');

        await importService.uploadFiles(parentNoteId, files, options);
    }
}
