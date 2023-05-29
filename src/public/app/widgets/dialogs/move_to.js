import noteAutocompleteService from "../../services/note_autocomplete.js";
import utils from "../../services/utils.js";
import toastService from "../../services/toast.js";
import froca from "../../services/froca.js";
import branchService from "../../services/branches.js";
import treeService from "../../services/tree.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="move-to-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" style="max-width: 1000px" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Move notes to ...</h5>
                
                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="move-to-form">
                <div class="modal-body">
                    <h5>Notes to move</h5>

                    <ul class="move-to-note-list" style="max-height: 200px; overflow: auto;"></ul>

                    <div class="form-group">
                        <label style="width: 100%">
                            Target parent note
                            <div class="input-group">
                                <input class="move-to-note-autocomplete form-control" placeholder="search for note by its name">
                            </div>
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Move to selected note <kbd>enter</kbd></button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class MoveToDialog extends BasicWidget {
    constructor() {
        super();

        this.movedBranchIds = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".move-to-form");
        this.$noteAutoComplete = this.$widget.find(".move-to-note-autocomplete");
        this.$noteList = this.$widget.find(".move-to-note-list");

        this.$form.on('submit', () => {
            const notePath = this.$noteAutoComplete.getSelectedNotePath();

            if (notePath) {
                this.$widget.modal('hide');

                const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromUrl(notePath);
                froca.getBranchId(parentNoteId, noteId).then(branchId => this.moveNotesTo(branchId));
            }
            else {
                logError("No path to move to.");
            }

            return false;
        });
    }

    async moveBranchIdsToEvent({branchIds}) {
        this.movedBranchIds = branchIds;

        utils.openDialog(this.$widget);

        this.$noteAutoComplete.val('').trigger('focus');

        this.$noteList.empty();

        for (const branchId of this.movedBranchIds) {
            const branch = froca.getBranch(branchId);
            const note = await froca.getNote(branch.noteId);

            this.$noteList.append($("<li>").text(note.title));
        }

        noteAutocompleteService.initNoteAutocomplete(this.$noteAutoComplete);
        noteAutocompleteService.showRecentNotes(this.$noteAutoComplete);
    }

    async moveNotesTo(parentBranchId) {
        await branchService.moveToParentNote(this.movedBranchIds, parentBranchId);

        const parentBranch = froca.getBranch(parentBranchId);
        const parentNote = await parentBranch.getNote();

        toastService.showMessage(`Selected notes have been moved into ${parentNote.title}`);
    }
}
