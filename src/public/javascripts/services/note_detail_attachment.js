import utils from "./utils.js";
import server from "./server.js";
import protectedSessionHolder from "./protected_session_holder.js";
import noteDetailService from "./note_detail.js";

const $noteDetailAttachment = $('#note-detail-attachment');

const $attachmentFileName = $("#attachment-filename");
const $attachmentFileType = $("#attachment-filetype");
const $attachmentFileSize = $("#attachment-filesize");
const $attachmentDownload = $("#attachment-download");
const $attachmentOpen = $("#attachment-open");

async function showFileNote() {
    const currentNote = noteDetailService.getCurrentNote();

    const labels = await server.get('notes/' + currentNote.noteId + '/labels');
    const labelMap = utils.toObject(labels, l => [l.name, l.value]);

    $noteDetailAttachment.show();

    $attachmentFileName.text(labelMap.original_file_name);
    $attachmentFileSize.text(labelMap.file_size + " bytes");
    $attachmentFileType.text(currentNote.mime);
}

$attachmentDownload.click(() => utils.download(getAttachmentUrl()));

$attachmentOpen.click(() => {
    if (utils.isElectron()) {
        const open = require("open");

        open(getAttachmentUrl());
    }
    else {
        window.location.href = getAttachmentUrl();
    }
});

function getAttachmentUrl() {
    // electron needs absolute URL so we extract current host, port, protocol
    return utils.getHost() + "/api/attachments/download/" + noteDetailService.getCurrentNoteId()
        + "?protectedSessionId=" + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());
}

export default {
    showFileNote,
    getContent: () => null,
    focus: () => null
}