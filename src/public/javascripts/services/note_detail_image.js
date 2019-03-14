import utils from "./utils.js";
import protectedSessionHolder from "./protected_session_holder.js";
import noteDetailService from "./note_detail.js";
import infoService from "./info.js";
import server from "./server.js";

const $component = $('#note-detail-image');
const $imageWrapper = $('#note-detail-image-wrapper');
const $imageView = $('#note-detail-image-view');

const $imageDownloadButton = $("#image-download");
const $copyToClipboardButton = $("#image-copy-to-clipboard");
const $fileName = $("#image-filename");
const $fileType = $("#image-filetype");
const $fileSize = $("#image-filesize");

async function show() {
    const activeNote = noteDetailService.getActiveNote();

    const attributes = await server.get('notes/' + activeNote.noteId + '/attributes');
    const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

    $component.show();

    $fileName.text(attributeMap.originalFileName || "?");
    $fileSize.text((attributeMap.fileSize || "?") + " bytes");
    $fileType.text(activeNote.mime);

    $imageView.prop("src", `api/images/${activeNote.noteId}/${activeNote.title}`);
}

$imageDownloadButton.click(() => utils.download(getFileUrl()));

function selectImage(element) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
}

$copyToClipboardButton.click(() => {
    $imageWrapper.attr('contenteditable','true');

    try {
        selectImage($imageWrapper.get(0));

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
        $imageWrapper.removeAttr('contenteditable');
    }
});

function getFileUrl() {
    // electron needs absolute URL so we extract current host, port, protocol
    return utils.getHost() + "/api/notes/" + noteDetailService.getActiveNoteId() + "/download";
}

export default {
    show,
    getContent: () => null,
    focus: () => null,
    onNoteChange: () => null,
    cleanup: () => null,
    scrollToTop: () => $component.scrollTop(0)
}