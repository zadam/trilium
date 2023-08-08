import noteAutocompleteService from "../../services/note_autocomplete.js";
import utils from "../../services/utils.js";
import treeService from "../../services/tree.js";
import toastService from "../../services/toast.js";
import froca from "../../services/froca.js";
import branchService from "../../services/branches.js";
import appContext from "../../components/app_context.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="clone-to-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" style="max-width: 1000px" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Clone notes to ...</h5>

                <button type="button" class="help-button" title="Help on links" data-help-page="Cloning-notes">?</button>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="clone-to-form">
                <div class="modal-body">
                    <h5>Notes to clone</h5>

                    <ul class="clone-to-note-list" style="max-height: 200px; overflow: auto;"></ul>

                    <div class="form-group">
                        <label style="width: 100%">
                            Target parent note
                            <div class="input-group">
                                <input class="clone-to-note-autocomplete form-control" placeholder="search for note by its name">
                            </div>
                        </label>
                    </div>

                    <div class="form-group" title="Cloned note will be shown in note tree with given prefix">
                        <label style="width: 100%">
                            Prefix (optional)
                            <input class="clone-prefix form-control" style="width: 100%;">
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Clone to selected note <kbd>enter</kbd></button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class CloneToDialog extends BasicWidget {
    constructor() {
        super();

        this.clonedNoteIds = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".clone-to-form");
        this.$noteAutoComplete = this.$widget.find(".clone-to-note-autocomplete");
        this.$clonePrefix = this.$widget.find(".clone-prefix");
        this.$noteList = this.$widget.find(".clone-to-note-list");

        this.$form.on('submit', () => {
            const notePath = this.$noteAutoComplete.getSelectedNotePath();

            if (notePath) {
                this.$widget.modal('hide');

                this.cloneNotesTo(notePath);
            }
            else {
                logError("No path to clone to.");
            }

            return false;
        });
    }

    async cloneNoteIdsToEvent({noteIds}) {
        if (!noteIds || noteIds.length === 0) {
            noteIds = [ appContext.tabManager.getActiveContextNoteId() ];
        }

        this.clonedNoteIds = [];

        for (const noteId of noteIds) {
            if (!this.clonedNoteIds.includes(noteId)) {
                this.clonedNoteIds.push(noteId);
            }
        }

        utils.openDialog(this.$widget);

        this.$noteAutoComplete.val('').trigger('focus');

        this.$noteList.empty();

        for (const noteId of this.clonedNoteIds) {
            const note = await froca.getNote(noteId);

            this.$noteList.append($("<li>").text(note.title));
        }

        noteAutocompleteService.initNoteAutocomplete(this.$noteAutoComplete);
        noteAutocompleteService.showRecentNotes(this.$noteAutoComplete);
    }

    async cloneNotesTo(notePath) {
        const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromUrl(notePath);
        const targetBranchId = await froca.getBranchId(parentNoteId, noteId);

        for (const cloneNoteId of this.clonedNoteIds) {
            await branchService.cloneNoteToBranch(cloneNoteId, targetBranchId, this.$clonePrefix.val());

            const clonedNote = await froca.getNote(cloneNoteId);
            const targetNote = await froca.getBranch(targetBranchId).getNote();

            toastService.showMessage(`Note "${clonedNote.title}" has been cloned into ${targetNote.title}`);
        }
    }
}
