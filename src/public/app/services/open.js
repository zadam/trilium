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

async function openCustom(type, entityId, mime) {
    checkType(type);
    if (!utils.isElectron() || utils.isMac()) {
        return;
    }

    const resp = await server.post(`${type}/${entityId}/save-to-tmp-dir`);
    let filePath = resp.tmpFilePath;
    const {exec} = utils.dynamicRequire('child_process');
    const platform = process.platform;

    if (platform === 'linux') {
        // we don't know which terminal is available, try in succession
        const terminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm', 'xfce4-terminal', 'mate-terminal', 'rxvt', 'terminator', 'terminology'];
        const openFileWithTerminal = (terminal) => {
            const command = `${terminal} -e 'mimeopen -d "${filePath}"'`;
            console.log(`Open Note custom: ${command} `);
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Open Note custom: Failed to open file with ${terminal}: ${error}`);
                    searchTerminal(terminals.indexOf(terminal) + 1);
                } else {
                    console.log(`Open Note custom: File opened with ${terminal}: ${stdout}`);
                }
            });
        };

        const searchTerminal = (index) => {
            const terminal = terminals[index];
            if (!terminal) {
                console.error('Open Note custom: No terminal found!');
                open(getFileUrl(entityId), {url: true});
                return;
            }
            exec(`which ${terminal}`, (error, stdout, stderr) => {
                if (stdout.trim()) {
                    openFileWithTerminal(terminal);
                } else {
                    searchTerminal(index + 1);
                }
            });
        };
        searchTerminal(0);
    } else if (platform === 'win32') {
        if (filePath.indexOf("/") !== -1) {
            // Note that the path separator must be \ instead of /
            filePath = filePath.replace(/\//g, "\\");
        }
        const command = `rundll32.exe shell32.dll,OpenAs_RunDLL ` + filePath;
        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.error("Open Note custom: ", err);
                open(getFileUrl(entityId), {url: true});
                return;
            }
        });
    } else {
        console.log('Currently "Open Note custom" only supports linux and windows systems');
        open(getFileUrl(entityId), {url: true});
    }
}

const openNoteCustom = async (noteId, mime) => await openCustom('notes', noteId, mime);
const openAttachmentCustom = async (attachmentId, mime) => await openCustom('attachments', attachmentId, mime);


function downloadRevision(noteId, revisionId) {
    const url = getUrlForDownload(`api/revisions/${revisionId}/download`);

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
        // web server can be deployed on subdomain, so we need to use a relative path
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
            window.open(getFileUrl(type, entityId));
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
    downloadRevision,
    downloadAttachment,
    getUrlForDownload,
    openNoteExternally,
    openAttachmentExternally,
    openNoteCustom,
    openAttachmentCustom,
}
