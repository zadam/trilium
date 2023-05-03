import utils from "./utils.js";
import server from "./server.js";

function checkType(type) {
    if (type !== 'notes' && type !== 'attachments') {
        throw new Error(`Unrecognized type '${type}', should be 'notes' or 'attachments'`);
    }
}

function getFileUrl(type, noteId) {
    checkType(type);

    return getUrlForDownload(`api/${type}/${noteId}/download`);
}

function getOpenFileUrl(type, noteId) {
    checkType(type);

    return getUrlForDownload(`api/${type}/${noteId}/open`);
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
    const url = `${getFileUrl('notes', noteId)}?${Date.now()}`; // don't use cache

    download(url);
}

function downloadAttachment(attachmentId) {
    const url = `${getFileUrl('attachments', attachmentId)}?${Date.now()}`; // don't use cache

    download(url);
}

function downloadNoteRevision(noteId, noteRevisionId) {
    const url = getUrlForDownload(`api/revisions/${noteRevisionId}/download`);

    download(url);
}

/**
 * @param url - should be without initial slash!!!
 */
function getUrlForDownload(url) {
    if (utils.isElectron()) {
        // electron needs absolute URL, so we extract current host, port, protocol
        return `${getHost()}/${url}`;
    }
    else {
        // web server can be deployed on subdomain, so we need to use relative path
        return url;
    }
}

function canOpenInBrowser(mime) {
    return mime === "application/pdf"
        || mime.startsWith("image")
        || mime.startsWith("audio")
        || mime.startsWith("video");
}

async function openExternally(type, entityId, mime) {
    checkType(type);

    if (utils.isElectron()) {
        const resp = await server.post(`${type}/${entityId}/save-to-tmp-dir`);

        const electron = utils.dynamicRequire('electron');
        const res = await electron.shell.openPath(resp.tmpFilePath);

        if (res) {
            // fallback in case there's no default application for this file
            window.open(getFileUrl(type, entityId), { url: true });
        }
    }
    else {
        // allow browser to handle opening common file
        if (canOpenInBrowser(mime)) {
            window.open(getOpenFileUrl(type, entityId));
        } else {
            window.location.href = getFileUrl(type, entityId);
        }
    }
}

const openNoteExternally = async (noteId, mime) => await openExternally('notes', noteId, mime);
const openAttachmentExternally = async (attachmentId, mime) => await openExternally('attachments', attachmentId, mime);

function getHost() {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.hostname}:${url.port}`;
}

export default {
    download,
    downloadFileNote,
    downloadNoteRevision,
    downloadAttachment,
    getUrlForDownload,
    openNoteExternally,
    openAttachmentExternally,
}
