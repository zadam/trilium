import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

const $dialog = $("#note-info-dialog");
const $noteId = $("#note-info-note-id");
const $dateCreated = $("#note-info-date-created");
const $dateModified = $("#note-info-date-modified");
const $type = $("#note-info-type");
const $mime = $("#note-info-mime");
const $okButton = $("#note-info-ok-button");

export async function showDialog() {
    utils.openDialog($dialog);

    const activeNoteContext = appContext.tabManager.getActiveNoteContext();
    const {note} = activeNoteContext;
    const noteComplement = await activeNoteContext.getNoteComplement();

    $noteId.text(note.noteId);
    $dateCreated.text(noteComplement.dateCreated);
    $dateModified.text(noteComplement.dateModified);
    $type.text(note.type);
    $mime.text(note.mime);
}

$okButton.on('click', () => $dialog.modal('hide'));
