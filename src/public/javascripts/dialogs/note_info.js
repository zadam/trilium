import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

const $dialog = $("#note-info-dialog");
const $noteId = $("#note-info-note-id");
const $dateCreated = $("#note-info-date-created");
const $dateModified = $("#note-info-date-modified");
const $type = $("#note-info-type");
const $mime = $("#note-info-mime");
const $okButton = $("#note-info-ok-button");

export function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    const activeNote = appContext.getActiveTabNote();

    $noteId.text(activeNote.noteId);
    $dateCreated.text(activeNote.dateCreated);
    $dateModified.text(activeNote.dateModified);
    $type.text(activeNote.type);
    $mime.text(activeNote.mime);
}

$okButton.on('click', () => $dialog.modal('hide'));
