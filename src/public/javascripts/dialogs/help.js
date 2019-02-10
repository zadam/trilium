const $dialog = $("#help-dialog");

async function showDialog() {
    glob.activeDialog = $dialog;

    $dialog.modal();
}

export default {
    showDialog
}