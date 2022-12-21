import utils from "./utils.js";
import server from "./server.js";

function getFileUrl(noteId) {
    return getUrlForDownload(`api/notes/${noteId}/download`);
}
function getOpenFileUrl(noteId) {
    return getUrlForDownload(`api/notes/${noteId}/open`);
}

function download(url) {
    if (utils.isElectron()) {
        const remote = utils.dynamicRequire('@electron/remote');

        remote.getCurrentWebContents().downloadURL(url);
    } else {
        window.location.href = url;
    }
}

function downloadFileNote(noteId) {
    const url = `${getFileUrl(noteId)}?${Date.now()}`; // don't use cache

    download(url);
}

async function openNoteExternally(noteId, mime) {
    if (utils.isElectron()) {
        const resp = await server.post(`notes/${noteId}/save-to-tmp-dir`);

        const electron = utils.dynamicRequire('electron');
        const res = await electron.shell.openPath(resp.tmpFilePath);

        if (res) {
            // fallback in case there's no default application for this file
            open(getFileUrl(noteId), {url: true});
        }
    }
    else {
        // allow browser to handle opening common file
         if (mime === "application/pdf" ||  mime.startsWith("image") || mime.startsWith("audio") || mime.startsWith("video")){
            window.open(getOpenFileUrl(noteId));
        }
         else {
            window.location.href = getFileUrl(noteId);
        }
    }
}

function downloadNoteRevision(noteId, noteRevisionId) {
    const url = getUrlForDownload(`api/notes/${noteId}/revisions/${noteRevisionId}/download`);

    download(url);
}

/**
 * @param url - should be without initial slash!!!
 */
function getUrlForDownload(url) {
    if (utils.isElectron()) {
        // electron needs absolute URL so we extract current host, port, protocol
        return `${getHost()}/${url}`;
    }
    else {
        // web server can be deployed on subdomain so we need to use relative path
        return url;
    }
}

function getHost() {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.hostname}:${url.port}`;
}

export default {
    download,
    downloadFileNote,
    openNoteExternally,
    downloadNoteRevision,
    getUrlForDownload
}
