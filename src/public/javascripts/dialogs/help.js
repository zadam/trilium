import utils from "../services/utils.js";

const $dialog = $("#help-dialog");

export async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();
}