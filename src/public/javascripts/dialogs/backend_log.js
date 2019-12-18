import server from "../services/server.js";
import utils from "../services/utils.js";

const $dialog = $("#backend-log-dialog");
const $backendLogTextArea = $("#backend-log-textarea");
const $refreshBackendLog = $("#refresh-backend-log-button");

export async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    load();
}

function scrollToBottom() {
    $backendLogTextArea.scrollTop($backendLogTextArea[0].scrollHeight);
}

async function load() {
    const backendLog = await server.get('backend-log');

    $backendLogTextArea.text(backendLog);

    scrollToBottom();
}

$refreshBackendLog.on('click', load);

$dialog.on('shown.bs.modal', scrollToBottom);