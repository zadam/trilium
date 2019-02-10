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
const $importButton = $("#import-button");

async function showDialog() {
    $importNoteCountWrapper.hide();
    $importNoteCount.text('0');
    $fileUploadInput.val('').change(); // to trigger Import button disabling listener below

    glob.activeDialog = $dialog;

    const currentNode = treeService.getCurrentNode();
    $noteTitle.text(await treeUtils.getNoteTitle(currentNode.data.noteId));

    $dialog.modal();
}

$form.submit(() => {
    const currentNode = treeService.getCurrentNode();

    // disabling so that import is not triggered again.
    $importButton.attr("disabled", "disabled");

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
        // we actually ignore the error since it can be caused by HTTP timeout and use WS messages instead.
        .fail((xhr, status, error) => {});
}

messagingService.subscribeToMessages(async message => {
    if (message.type === 'import-note-count') {
        $importNoteCountWrapper.show();

        $importNoteCount.text(message.count);
    }
    else if (message.type === 'import-finished') {
        $dialog.modal('hide');

        infoService.showMessage("Import finished successfully.");

        await treeService.reload();

        if (message.noteId) {
            const node = await treeService.activateNote(message.noteId);

            node.setExpanded(true);
        }
    }
});

$fileUploadInput.change(() => {
    if ($fileUploadInput.val()) {
        $importButton.removeAttr("disabled");
    }
    else {
        $importButton.attr("disabled", "disabled");
    }
});

export default {
    showDialog
}