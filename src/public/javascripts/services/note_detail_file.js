import utils from "./utils.js";
import server from "./server.js";
import protectedSessionHolder from "./protected_session_holder.js";
import noteDetailService from "./note_detail.js";

const $noteDetailFile = $('#note-detail-file');

const $fileFileName = $("#file-filename");
const $fileFileType = $("#file-filetype");
const $fileFileSize = $("#file-filesize");
const $fileDownload = $("#file-download");
const $fileOpen = $("#file-open");

async function show() {
    const currentNote = noteDetailService.getCurrentNote();

    const attributes = await server.get('notes/' + currentNote.noteId + '/attributes');
    const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

    $noteDetailFile.show();

    $fileFileName.text(attributeMap.originalFileName);
    $fileFileSize.text(attributeMap.fileSize + " bytes");
    $fileFileType.text(currentNote.mime);
}

$fileDownload.click(() => utils.download(getFileUrl()));

$fileOpen.click(() => {
    if (utils.isElectron()) {
        const open = require("open");

        open(getFileUrl());
    }
    else {
        window.location.href = getFileUrl();
    }
});

function getFileUrl() {
    // electron needs absolute URL so we extract current host, port, protocol
    return utils.getHost() + "/api/notes/" + noteDetailService.getCurrentNoteId()
        + "/download?protectedSessionId=" + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());
}

export default {
    show,
    getContent: () => null,
    focus: () => null,
    onNoteChange: () => null
}