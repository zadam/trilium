import server from "../services/server.js";
import utils from "../services/utils.js";

const $dialog = $("#sort-child-notes-dialog");

export async function showDialog() {
    utils.openDialog($dialog);
}
