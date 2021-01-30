import utils from "../../services/utils.js";
import toastService from "../../services/toast.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-image note-detail-printable">
    <style>
        .type-image {
            height: 100%;
        }
    
        .note-detail-image {
            text-align: center;
            height: 100%;
            overflow: auto;
        }
        
        .note-detail-image-view {
            max-width: 100%;
        }
    </style>

    <div class="note-detail-image-wrapper">
        <img class="note-detail-image-view" />
    </div>
</div>`;

class ImageTypeWidget extends TypeWidget {
    static getType() { return "image"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$imageWrapper = this.$widget.find('.note-detail-image-wrapper');
        this.$imageView = this.$widget.find('.note-detail-image-view');
    }

    async doRefresh(note) {
        const imageHash = utils.randomString(10);

        this.$imageView.prop("src", `api/images/${note.noteId}/${note.title}?${imageHash}`);
    }

    copyImageToClipboardEvent({tabId}) {
        if (!this.isTab(tabId)) {
            return;
        }

        this.$imageWrapper.attr('contenteditable','true');

        try {
            this.selectImage(this.$imageWrapper.get(0));

            const success = document.execCommand('copy');

            if (success) {
                toastService.showMessage("Image copied to the clipboard");
            }
            else {
                toastService.showAndLogError("Could not copy the image to clipboard.");
            }
        }
        finally {
            window.getSelection().removeAllRanges();
            this.$imageWrapper.removeAttr('contenteditable');
        }
    }

    selectImage(element) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

export default ImageTypeWidget
