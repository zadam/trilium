const $dialog = $("#info-dialog");
const $infoContent = $("#info-dialog-content");
const $okButton = $("#info-dialog-ok-button");

let resolve;

function info(message) {
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
});

$okButton.click(() => $dialog.modal("hide"));

export default {
    info
}