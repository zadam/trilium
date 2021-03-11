const $dialog = $("#delete-notes-dialog");
const $confirmContent = $("#delete-notes-dialog-content");
const $okButton = $("#delete-notes-dialog-ok-button");
const $cancelButton = $("#delete-notes-dialog-cancel-button");
const $custom = $("#delete-notes-dialog-custom");

const DELETE_NOTE_BUTTON_ID = "delete-notes-dialog-delete-note";

let $originallyFocused; // element focused before the dialog was opened so we can return to it afterwards

export function showDialog(message) {
    $originallyFocused = $(':focus');

    $custom.hide();

    glob.activeDialog = $dialog;

    if (typeof message === 'string') {
        message = $("<div>").text(message);
    }

    $confirmContent.empty().append(message);

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

export function isDeleteNoteChecked() {
    return $("#" + DELETE_NOTE_BUTTON_ID + ":checked").length > 0;
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve(false);
    }

    if ($originallyFocused) {
        $originallyFocused.trigger('focus');
        $originallyFocused = null;
    }
});

function doResolve(ret) {
    resolve(ret);
    resolve = null;

    $dialog.modal("hide");
}

$cancelButton.on('click', () => doResolve(false));
$okButton.on('click', () => doResolve(true));
