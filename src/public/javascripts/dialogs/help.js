import utils from "../services/utils.js";

const $dialog = $("#help-dialog");

async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();
}

export default {
    showDialog
}