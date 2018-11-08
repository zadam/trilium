import utils from "./utils.js";
import server from "./server.js";
import protectedSessionHolder from "./protected_session_holder.js";
import noteDetailService from "./note_detail.js";

const $component = $('#note-detail-image');
const $imageView = $('#note-detail-image-view');

const $imageDownload = $("#image-download");

async function show() {
    const currentNote = noteDetailService.getCurrentNote();

    $component.show();

    $imageView.prop("src", `/api/images/${currentNote.noteId}/${currentNote.title}`);
}

$imageDownload.click(() => utils.download(getFileUrl()));

function getFileUrl() {
    // electron needs absolute URL so we extract current host, port, protocol
    return utils.getHost() + "/api/notes/" + noteDetailService.getCurrentNoteId()
        + "/download?protectedSessionId=" + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());
}

export default {
    show,
    getContent: () => null,
    focus: () => null,
    onNoteChange: () => null,
    cleanup: () => null
}