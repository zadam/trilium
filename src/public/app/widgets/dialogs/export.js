import treeService from "../../services/tree.js";
import utils from "../../services/utils.js";
import ws from "../../services/ws.js";
import toastService from "../../services/toast.js";
import froca from "../../services/froca.js";
import openService from "../../services/open.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="export-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <style>
    .export-dialog .export-form .form-check {
        padding-top: 10px;
        padding-bottom: 10px;
    }
    
    .export-dialog .export-form .format-choice {
        padding-left: 40px;
        display: none;
    }
    
    .export-dialog .export-form .opml-versions {
        padding-left: 60px;
        display: none;
    }
    
    .export-dialog .export-form .form-check-label {
        padding: 2px;
    }
    </style>

    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Export note "<span class="export-note-title"></span>"</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="export-form">
                <div class="modal-body">
                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="export-type-subtree form-check-input" type="radio" name="export-type" value="subtree">
                            this note and all of its descendants
                        </label>
                    </div>

                    <div class="export-subtree-formats format-choice">
                        <div class="form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="export-subtree-format" value="html">
                                HTML in ZIP archive - this is recommended since this preserves all the formatting.
                            </label>
                        </div>

                        <div class="form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="export-subtree-format" value="markdown">
                                Markdown - this preserves most of the formatting.
                            </label>
                        </div>

                        <div class="form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="export-subtree-format" value="opml">
                                OPML - outliner interchange format for text only. Formatting, images and files are not included.
                            </label>
                        </div>

                        <div class="opml-versions">
                            <div class="form-check">
                                <label class="form-check-label">
                                    <input class="form-check-input" type="radio" name="opml-version" value="1.0">
                                    OPML v1.0 - plain text only
                                </label>
                            </div>

                            <div class="form-check">
                                <label class="form-check-label">
                                    <input class="form-check-input" type="radio" name="opml-version" value="2.0">
                                    OMPL v2.0 - allows also HTML
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="form-check-input" type="radio" name="export-type" value="single">
                            only this note without its descendants
                        </label>
                    </div>

                    <div class="export-single-formats format-choice">
                        <div class="form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="export-single-format" value="html">
                                HTML - this is recommended since this preserves all the formatting.
                            </label>
                        </div>

                        <div class="form-check">
                            <label class="form-check-label">
                                <input class="form-check-input" type="radio" name="export-single-format" value="markdown">                            
                                Markdown - this preserves most of the formatting.
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="export-button btn btn-primary">Export</button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class ExportDialog extends BasicWidget {
    constructor() {
        super();

        this.taskId = '';
        this.branchId = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".export-form");
        this.$noteTitle = this.$widget.find(".export-note-title");
        this.$subtreeFormats = this.$widget.find(".export-subtree-formats");
        this.$singleFormats = this.$widget.find(".export-single-formats");
        this.$subtreeType = this.$widget.find(".export-type-subtree");
        this.$singleType = this.$widget.find(".export-type-single");
        this.$exportButton = this.$widget.find(".export-button");
        this.$opmlVersions = this.$widget.find(".opml-versions");

        this.$form.on('submit', () => {
            this.$widget.modal('hide');

            const exportType = this.$widget.find("input[name='export-type']:checked").val();

            if (!exportType) {
                // this shouldn't happen as we always choose default export type
                toastService.showError("Choose export type first please");
                return;
            }

            const exportFormat = exportType === 'subtree'
                ? this.$widget.find("input[name=export-subtree-format]:checked").val()
                : this.$widget.find("input[name=export-single-format]:checked").val();

            const exportVersion = exportFormat === 'opml'
                ? this.$widget.find("input[name='opml-version']:checked").val()
                : "1.0";

            this.exportBranch(this.branchId, exportType, exportFormat, exportVersion);

            return false;
        });

        this.$widget.find('input[name=export-type]').on('change', e => {
            if (e.currentTarget.value === 'subtree') {
                if (this.$widget.find("input[name=export-subtree-format]:checked").length === 0) {
                    this.$widget.find("input[name=export-subtree-format]:first").prop("checked", true);
                }

                this.$subtreeFormats.slideDown();
                this.$singleFormats.slideUp();
            }
            else {
                if (this.$widget.find("input[name=export-single-format]:checked").length === 0) {
                    this.$widget.find("input[name=export-single-format]:first").prop("checked", true);
                }

                this.$subtreeFormats.slideUp();
                this.$singleFormats.slideDown();
            }
        });

        this.$widget.find('input[name=export-subtree-format]').on('change', e => {
            if (e.currentTarget.value === 'opml') {
                this.$opmlVersions.slideDown();
            }
            else {
                this.$opmlVersions.slideUp();
            }
        });
    }

    async showExportDialogEvent({notePath, defaultType}) {
        // each opening of the dialog resets the taskId, so we don't associate it with previous exports anymore
        this.taskId = '';
        this.$exportButton.removeAttr("disabled");

        if (defaultType === 'subtree') {
            this.$subtreeType.prop("checked", true).trigger('change');

            // to show/hide OPML versions
            this.$widget.find("input[name=export-subtree-format]:checked").trigger('change');
        }
        else if (defaultType === 'single') {
            this.$singleType.prop("checked", true).trigger('change');
        }
        else {
            throw new Error(`Unrecognized type ${defaultType}`);
        }

        this.$widget.find(".opml-v2").prop("checked", true); // setting default

        utils.openDialog(this.$widget);

        const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);

        this.branchId = await froca.getBranchId(parentNoteId, noteId);
        this.$noteTitle.text(await treeService.getNoteTitle(noteId));
    }

    exportBranch(branchId, type, format, version) {
        this.taskId = utils.randomString(10);

        const url = openService.getUrlForDownload(`api/notes/${branchId}/export/${type}/${format}/${version}/${this.taskId}`);

        openService.download(url);
    }
}

ws.subscribeToMessages(async message => {
    const makeToast = (id, message) => ({
        id: id,
        title: "Export status",
        message: message,
        icon: "arrow-square-up-right"
    });

    if (message.taskType !== 'export') {
        return;
    }

    if (message.type === 'taskError') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    }
    else if (message.type === 'taskProgressCount') {
        toastService.showPersistent(makeToast(message.taskId, `Export in progress: ${message.progressCount}`));
    }
    else if (message.type === 'taskSucceeded') {
        const toast = makeToast(message.taskId, "Export finished successfully.");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});
