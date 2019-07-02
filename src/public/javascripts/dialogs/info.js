import utils from "../services/utils.js";

const $dialog = $("#info-dialog");
const $infoContent = $("#info-dialog-content");
const $okButton = $("#info-dialog-ok-button");

let resolve;
let $originallyFocused; // element focused before the dialog was opened so we can return to it afterwards

function info(message) {
    $originallyFocused = $(':focus');

    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $infoContent.text(message);

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve();
    }

    if ($originallyFocused) {
        $originallyFocused.focus();
        $originallyFocused = null;
    }
});

$okButton.click(() => $dialog.modal("hide"));

export default {
    info
}