import utils from "./utils.js";
import protectedSessionHolder from "./protected_session_holder.js";
import noteDetailService from "./note_detail.js";
import infoService from "./info.js";

const $component = $('#note-detail-image');
const $imageView = $('#note-detail-image-view');

const $imageDownload = $("#image-download");
const $copyToClipboardDownload = $("#image-copy-to-clipboard");

async function show() {
    const currentNote = noteDetailService.getCurrentNote();

    $component.show();

    $imageView.prop("src", `/api/images/${currentNote.noteId}/${currentNote.title}`);
}

$imageDownload.click(() => utils.download(getFileUrl()));

function selectImage(element) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
}

$copyToClipboardDownload.click(() => {
    $component.attr('contenteditable','true');

    try {
        selectImage($component.get(0));

        const success = document.execCommand('copy');

        if (success) {
            infoService.showMessage("Image copied to the clipboard");
        }
        else {
            infoService.showAndLogError("Could not copy the image to clipboard.");
        }
    }
    finally {
        window.getSelection().removeAllRanges();
        $component.removeAttr('contenteditable');
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
    onNoteChange: () => null,
    cleanup: () => null
}