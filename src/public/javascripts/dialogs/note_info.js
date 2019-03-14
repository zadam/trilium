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

    const activeNote = noteDetailService.getActiveNote();

    $noteId.text(activeNote.noteId);
    $utcDateCreated.text(activeNote.utcDateCreated);
    $utcDateModified.text(activeNote.utcDateModified);
    $type.text(activeNote.type);
    $mime.text(activeNote.mime);
}

$okButton.click(() => $dialog.modal('hide'));

export default {
    showDialog
};