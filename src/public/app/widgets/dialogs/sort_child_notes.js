import server from "../../services/server.js";
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `<div class="sort-child-notes-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" style="max-width: 500px" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Sort children by ...</h5>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <form class="sort-child-notes-form">
                <div class="modal-body">
                    <h5>Sorting criteria</h5>

                    <div class="form-check">
                        <label class="form-check-label">
                           <input class="form-check-input" type="radio" name="sort-by" value="title" checked>
                            title
                        </label>
                    </div>

                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="form-check-input" type="radio" name="sort-by" value="dateCreated">
                            date created
                        </label>
                    </div>

                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="form-check-input" type="radio" name="sort-by" value="dateModified">
                            date modified
                        </label>
                    </div>

                    <br/>

                    <h5>Sorting direction</h5>

                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="form-check-input" type="radio" name="sort-direction" value="asc" checked>
                            ascending
                        </label>
                    </div>

                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="form-check-input" type="radio" name="sort-direction" value="desc">
                            descending
                        </label>
                    </div>

                    <br />

                    <h5>Folders</h5>

                    <div class="form-check">
                        <label class="form-check-label">
                            <input class="form-check-input" type="checkbox" name="sort-folders-first" value="1">
                            sort folders at the top
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Sort <kbd>enter</kbd></button>
                </div>
            </form>
        </div>
    </div>
</div>`;

export default class SortChildNotesDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$form = this.$widget.find(".sort-child-notes-form");

        this.$form.on('submit', async () => {
            const sortBy = this.$form.find("input[name='sort-by']:checked").val();
            const sortDirection = this.$form.find("input[name='sort-direction']:checked").val();
            const foldersFirst = this.$form.find("input[name='sort-folders-first']").is(":checked");

            await server.put(`notes/${this.parentNoteId}/sort-children`, {sortBy, sortDirection, foldersFirst});

            utils.closeActiveDialog();
        });
    }

    async sortChildNotesEvent({node}) {
        this.parentNoteId = node.data.noteId;

        utils.openDialog(this.$widget);

        this.$form.find('input:first').focus();
    }
}
