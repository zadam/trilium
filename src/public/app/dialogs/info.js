import utils from "../services/utils.js";

const $dialog = $("#info-dialog");
const $infoContent = $("#info-dialog-content");
const $okButton = $("#info-dialog-ok-button");

let resolve;
let $originallyFocused; // element focused before the dialog was opened so we can return to it afterwards

export function info(message) {
    $originallyFocused = $(':focus');

    $infoContent.text(message);

    utils.openDialog($dialog);

    return new Promise((res, rej) => { resolve = res; });
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve();
    }

    if ($originallyFocused) {
        $originallyFocused.trigger('focus');
        $originallyFocused = null;
    }
});

$okButton.on('click', () => $dialog.modal("hide"));