import treeService from '../services/tree.js';
import utils from '../services/utils.js';
import treeUtils from "../services/tree_utils.js";
import server from "../services/server.js";
import infoService from "../services/info.js";
import messagingService from "../services/messaging.js";

const $dialog = $("#import-dialog");
const $form = $("#import-form");
const $noteTitle = $dialog.find(".note-title");
const $fileUploadInput = $("#import-file-upload-input");
const $importProgressCountWrapper = $("#import-progress-count-wrapper");
const $importProgressCount = $("#import-progress-count");
const $importButton = $("#import-button");
const $safeImportCheckbox = $("#safe-import-checkbox");
const $shrinkImagesCheckbox = $("#shrink-images-checkbox");
const $textImportedAsTextCheckbox = $("#text-imported-as-text-checkbox");
const $codeImportedAsCodeCheckbox = $("#code-imported-as-code-checkbox");

let importId;

async function showDialog() {
    // each opening of the dialog resets the importId so we don't associate it with previous imports anymore
    importId = '';
    $importProgressCountWrapper.hide();
    $importProgressCount.text('0');
    $fileUploadInput.val('').change(); // to trigger Import button disabling listener below

    $safeImportCheckbox.prop("checked", true);
    $shrinkImagesCheckbox.prop("checked", true);
    $textImportedAsTextCheckbox.prop("checked", true);
    $codeImportedAsCodeCheckbox.prop("checked", true);

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

async function importIntoNote(importNoteId) {
    const files = Array.from($fileUploadInput[0].files); // shallow copy since we're resetting the upload button below

    // we generate it here (and not on opening) for the case when you try to import multiple times from the same
    // dialog (which shouldn't happen, but still ...)
    importId = utils.randomString(10);

    const options = {
        safeImport: boolToString($safeImportCheckbox),
        shrinkImages: boolToString($shrinkImagesCheckbox),
        textImportedAsText: boolToString($textImportedAsTextCheckbox),
        codeImportedAsCode: boolToString($codeImportedAsCodeCheckbox)
    };

    await uploadFiles(importNoteId, files, options);

    $dialog.modal('hide');
}

async function uploadFiles(importNoteId, files, options) {
    let noteId;

    for (const file of files) {
        const formData = new FormData();
        formData.append('upload', file);
        formData.append('importId', importId);
        formData.append('safeImport', options.safeImport);
        formData.append('shrinkImages', options.shrinkImages);
        formData.append('textImportedAsText', options.textImportedAsText);
        formData.append('codeImportedAsCode', options.codeImportedAsCode);

        ({noteId} = await $.ajax({
            url: baseApiUrl + 'notes/' + importNoteId + '/import',
            headers: server.getHeaders(),
            data: formData,
            dataType: 'json',
            type: 'POST',
            timeout: 60 * 60 * 1000,
            contentType: false, // NEEDED, DON'T REMOVE THIS
            processData: false, // NEEDED, DON'T REMOVE THIS
        }));
    }

    infoService.showMessage("Import finished successfully.");

    await treeService.reload();

    if (noteId) {
        const node = await treeService.activateNote(noteId);

        node.setExpanded(true);
    }
}

function boolToString($el) {
    return $el.is(":checked") ? "true" : "false";
}

messagingService.subscribeToMessages(async message => {
    if (message.type === 'import-error') {
        infoService.showError(message.message);
        $dialog.modal('hide');
        return;
    }

    if (!message.importId || message.importId !== importId) {
        // incoming messages must correspond to this import instance
        return;
    }

    if (message.type === 'import-progress-count') {
        $importProgressCountWrapper.slideDown();

        $importProgressCount.text(message.progressCount);
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
    showDialog,
    uploadFiles
}