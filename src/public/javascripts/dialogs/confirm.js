const $dialog = $("#confirm-dialog");
const $confirmContent = $("#confirm-dialog-content");
const $okButton = $("#confirm-dialog-ok-button");
const $cancelButton = $("#confirm-dialog-cancel-button");

let resolve;

function confirm(message) {
    glob.activeDialog = $dialog;

    $confirmContent.text(message);

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve(false);
    }
});

function doResolve(ret) {
    resolve(ret);
    resolve = null;

    $dialog.modal("hide");
}

$cancelButton.click(() => doResolve(false));
$okButton.click(() => doResolve(true));

export default {
    confirm
}