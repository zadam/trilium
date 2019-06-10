import server from "../services/server.js";
import utils from "../services/utils.js";

const $dialog = $("#about-dialog");
const $appVersion = $("#app-version");
const $dbVersion = $("#db-version");
const $syncVersion = $("#sync-version");
const $buildDate = $("#build-date");
const $buildRevision = $("#build-revision");
const $dataDirectory = $("#data-directory");

async function showDialog() {
    utils.closeActiveDialog();

    const appInfo = await server.get('app-info');

    $appVersion.text(appInfo.appVersion);
    $dbVersion.text(appInfo.dbVersion);
    $syncVersion.text(appInfo.syncVersion);
    $buildDate.text(appInfo.buildDate);
    $buildRevision.text(appInfo.buildRevision);
    $buildRevision.attr('href', 'https://github.com/zadam/trilium/commit/' + appInfo.buildRevision);
    $dataDirectory.text(appInfo.dataDirectory);

    glob.activeDialog = $dialog;

    $dialog.modal();
}

export default {
    showDialog
}