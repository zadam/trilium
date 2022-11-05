import server from "../../services/server.js";
import froca from "../../services/froca.js";
import linkService from "../../services/link.js";
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="delete-notes-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-dialog-scrollable modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title mr-auto">Delete notes preview</h4>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="checkbox">
                    <label>
                        <input class="delete-all-clones" value="1" type="checkbox">

                        delete also all clones (can be undone in recent changes)
                    </label>
                </div>

                <div class="checkbox">
                    <label title="Normal (soft) deletion only marks the notes as deleted and they can be undeleted (in recent changes dialog) within a period of time. Checking this option will erase the notes immediatelly and it won't be possible to undelete the notes.">
                        <input class="erase-notes" value="1" type="checkbox">

                        erase notes permanently (can't be undone), including all clones. This will force application reload.
                    </label>
                </div>

                <div class="delete-notes-list-wrapper">
                    <h4>Following notes will be deleted (<span class="deleted-notes-count"></span>)</h4>

                    <ul class="delete-notes-list" style="max-height: 200px; overflow: auto;"></ul>
                </div>

                <div class="no-note-to-delete-wrapper alert alert-info">
                    No note will be deleted (only clones).
                </div>

                <div class="broken-relations-wrapper">
                    <div class="alert alert-danger">
                        <h4>Following relations will be broken and deleted (<span class="broke-relations-count"></span>)</h4>

                        <ul class="broken-relations-list" style="max-height: 200px; overflow: auto;"></ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="delete-notes-dialog-cancel-button btn btn-sm">Cancel</button>

                &nbsp;

                <button class="delete-notes-dialog-ok-button btn btn-primary btn-sm">OK</button>
            </div>
        </div>
    </div>
</div>`;

export default class DeleteNotesDialog extends BasicWidget {
    constructor() {
        super();

        this.branchIds = null;
        this.resolve = null;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find(".recent-changes-content");
        this.$okButton = this.$widget.find(".delete-notes-dialog-ok-button");
        this.$cancelButton = this.$widget.find(".delete-notes-dialog-cancel-button");
        this.$deleteNotesList = this.$widget.find(".delete-notes-list");
        this.$brokenRelationsList = this.$widget.find(".broken-relations-list");
        this.$deletedNotesCount = this.$widget.find(".deleted-notes-count");
        this.$noNoteToDeleteWrapper = this.$widget.find(".no-note-to-delete-wrapper");
        this.$deleteNotesListWrapper = this.$widget.find(".delete-notes-list-wrapper");
        this.$brokenRelationsListWrapper = this.$widget.find(".broken-relations-wrapper");
        this.$brokenRelationsCount = this.$widget.find(".broke-relations-count");
        this.$deleteAllClones = this.$widget.find(".delete-all-clones");
        this.$eraseNotes = this.$widget.find(".erase-notes");

        this.$widget.on('shown.bs.modal', () => this.$okButton.trigger("focus"));

        this.$cancelButton.on('click', () => {
            utils.closeActiveDialog();

            this.resolve({proceed: false});
        });

        this.$okButton.on('click', () => {
            utils.closeActiveDialog();

            this.resolve({
                proceed: true,
                deleteAllClones: this.forceDeleteAllClones || this.isDeleteAllClonesChecked(),
                eraseNotes: this.isEraseNotesChecked()
            });
        });

        this.$deleteAllClones.on('click', () => this.renderDeletePreview());
    }

    async renderDeletePreview() {
        const response = await server.post('delete-notes-preview', {
            branchIdsToDelete: this.branchIds,
            deleteAllClones: this.forceDeleteAllClones || this.isDeleteAllClonesChecked()
        });

        this.$deleteNotesList.empty();
        this.$brokenRelationsList.empty();

        this.$deleteNotesListWrapper.toggle(response.noteIdsToBeDeleted.length > 0);
        this.$noNoteToDeleteWrapper.toggle(response.noteIdsToBeDeleted.length === 0);

        for (const note of await froca.getNotes(response.noteIdsToBeDeleted)) {
            this.$deleteNotesList.append(
                $("<li>").append(
                    await linkService.createNoteLink(note.noteId, {showNotePath: true})
                )
            );
        }

        this.$deletedNotesCount.text(response.noteIdsToBeDeleted.length);

        this.$brokenRelationsListWrapper.toggle(response.brokenRelations.length > 0);
        this.$brokenRelationsCount.text(response.brokenRelations.length);

        await froca.getNotes(response.brokenRelations.map(br => br.noteId));

        for (const attr of response.brokenRelations) {
            this.$brokenRelationsList.append(
                $("<li>")
                    .append(`Note `)
                    .append(await linkService.createNoteLink(attr.value))
                    .append(` (to be deleted) is referenced by relation <code>${attr.name}</code> originating from `)
                    .append(await linkService.createNoteLink(attr.noteId))
            );
        }
    }

    async showDeleteNotesDialogEvent({branchIdsToDelete, callback, forceDeleteAllClones}) {
        this.branchIds = branchIdsToDelete;
        this.forceDeleteAllClones = forceDeleteAllClones;

        await this.renderDeletePreview();

        utils.openDialog(this.$widget);

        this.$deleteAllClones
            .prop("checked", !!forceDeleteAllClones)
            .prop("disabled", !!forceDeleteAllClones);

        this.$eraseNotes.prop("checked", false);

        this.resolve = callback;
    }

    isDeleteAllClonesChecked() {
        return this.$deleteAllClones.is(":checked");
    }

    isEraseNotesChecked() {
        return this.$eraseNotes.is(":checked");
    }
}
