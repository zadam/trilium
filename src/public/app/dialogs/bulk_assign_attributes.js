import utils from "../services/utils.js";

const $dialog = $("#bulk-assign-attributes-dialog");

export async function showDialog(nodes) {
    utils.openDialog($dialog);
}
