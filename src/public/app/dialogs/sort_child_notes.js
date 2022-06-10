import server from "../services/server.js";
import utils from "../services/utils.js";

const $dialog = $("#sort-child-notes-dialog");
const $form = $("#sort-child-notes-form");

let parentNoteId = null;

$form.on('submit', async () => {
    const sortBy = $form.find("input[name='sort-by']:checked").val();
    const sortDirection = $form.find("input[name='sort-direction']:checked").val();
    const foldersFirst = $form.find("input[name='sort-folders-first']").is(":checked");

    await server.put(`notes/${parentNoteId}/sort-children`, {sortBy, sortDirection, foldersFirst});

    utils.closeActiveDialog();
});

export async function showDialog(noteId) {
    parentNoteId = noteId;

    utils.openDialog($dialog);

    $form.find('input:first').focus();
}
