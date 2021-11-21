import utils from '../services/utils.js';
import treeService from "../services/tree.js";
import importService from "../services/import.js";
import options from "../services/options.js";

const $dialog = $("#import-dialog");
const $form = $("#import-form");
const $noteTitle = $dialog.find(".import-note-title");
const $fileUploadInput = $("#import-file-upload-input");
const $importButton = $("#import-button");
const $safeImportCheckbox = $("#safe-import-checkbox");
const $shrinkImagesWrapper = $("shrink-images-wrapper");
const $shrinkImagesCheckbox = $("#shrink-images-checkbox");
const $textImportedAsTextCheckbox = $("#text-imported-as-text-checkbox");
const $codeImportedAsCodeCheckbox = $("#code-imported-as-code-checkbox");
const $explodeArchivesCheckbox = $("#explode-archives-checkbox");
const $replaceUnderscoresWithSpacesCheckbox = $("#replace-underscores-with-spaces-checkbox");
const $csrf = $("#import-csrf");

let parentNoteId = null;

export async function showDialog(noteId) {
    $fileUploadInput.val('').trigger('change'); // to trigger Import button disabling listener below

    $safeImportCheckbox.prop("checked", true);
    $shrinkImagesCheckbox.prop("checked", options.is('compressImages'));
    $textImportedAsTextCheckbox.prop("checked", true);
    $codeImportedAsCodeCheckbox.prop("checked", true);
    $explodeArchivesCheckbox.prop("checked", true);
    $replaceUnderscoresWithSpacesCheckbox.prop("checked", true);

    parentNoteId = noteId;

    $noteTitle.text(await treeService.getNoteTitle(parentNoteId));

    utils.openDialog($dialog);
}

$form.on('submit', () => {
    // disabling so that import is not triggered again.
    $importButton.attr("disabled", "disabled");

    importIntoNote(parentNoteId);

    return false;
});

async function importIntoNote(parentNoteId) {
    const files = Array.from($fileUploadInput[0].files); // shallow copy since we're resetting the upload button below

    const options = {
        safeImport: boolToString($safeImportCheckbox),
        shrinkImages: boolToString($shrinkImagesCheckbox),
        textImportedAsText: boolToString($textImportedAsTextCheckbox),
        codeImportedAsCode: boolToString($codeImportedAsCodeCheckbox),
        explodeArchives: boolToString($explodeArchivesCheckbox),
        replaceUnderscoresWithSpaces: boolToString($replaceUnderscoresWithSpacesCheckbox)
    };

    $dialog.modal('hide');

    await importService.uploadFiles(parentNoteId, files, options);
}

function boolToString($el) {
    return $el.is(":checked") ? "true" : "false";
}

$fileUploadInput.on('change', () => {
    if ($fileUploadInput.val()) {
        $importButton.removeAttr("disabled");
    }
    else {
        $importButton.attr("disabled", "disabled");
    }
});
