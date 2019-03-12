import noteDetailService from '../services/note_detail.js';

const $dialog = $("#note-info-dialog");
const $noteId = $("#note-info-note-id");
const $utcDateCreated = $("#note-info-date-created");
const $utcDateModified = $("#note-info-date-modified");
const $type = $("#note-info-type");
const $mime = $("#note-info-mime");
const $okButton = $("#note-info-ok-button");

function showDialog() {
    glob.activeDialog = $dialog;

    $dialog.modal();

    const currentNote = noteDetailService.getCurrentNote();

    $noteId.text(currentNote.noteId);
    $utcDateCreated.text(currentNote.utcDateCreated);
    $utcDateModified.text(currentNote.utcDateModified);
    $type.text(currentNote.type);
    $mime.text(currentNote.mime);
}

$okButton.click(() => $dialog.modal('hide'));

export default {
    showDialog
};