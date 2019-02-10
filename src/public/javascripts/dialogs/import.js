import treeService from '../services/tree.js';
import treeUtils from "../services/tree_utils.js";
import server from "../services/server.js";
import infoService from "../services/info.js";
import messagingService from "../services/messaging.js";

const $dialog = $("#import-dialog");
const $form = $("#import-form");
const $noteTitle = $dialog.find(".note-title");
const $fileUploadInput = $("#import-file-upload-input");
const $importNoteCountWrapper = $("#import-note-count-wrapper");
const $importNoteCount = $("#import-note-count");

async function showDialog() {
    $importNoteCountWrapper.hide();
    $importNoteCount.text('0');
    $fileUploadInput.val('');

    glob.activeDialog = $dialog;

    const currentNode = treeService.getCurrentNode();
    $noteTitle.text(await treeUtils.getNoteTitle(currentNode.data.noteId));

    $dialog.modal();
}

$form.submit(() => {
    const currentNode = treeService.getCurrentNode();

    importIntoNote(currentNode.data.noteId);

    return false;
});

function importIntoNote(importNoteId) {
    const formData = new FormData();
    formData.append('upload', $fileUploadInput[0].files[0]);

    $.ajax({
        url: baseApiUrl + 'notes/' + importNoteId + '/import',
        headers: server.getHeaders(),
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false, // NEEDED, DON'T REMOVE THIS
        processData: false, // NEEDED, DON'T REMOVE THIS
    })
        .fail((xhr, status, error) => alert('Import error: ' + xhr.responseText))
        .done(async note => {
            $dialog.modal('hide');

            infoService.showMessage("Import finished successfully.");

            await treeService.reload();

            if (note) {
                const node = await treeService.activateNote(note.noteId);

                node.setExpanded(true);
            }
        });
}

messagingService.subscribeToMessages(message => {
    if (message.type === 'importNoteCount') {
        $importNoteCountWrapper.show();

        $importNoteCount.text(message.count);
    }
});

export default {
    showDialog
}