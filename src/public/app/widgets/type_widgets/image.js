import utils from "../../services/utils.js";
import toastService from "../../services/toast.js";
import TypeWidget from "./type_widget.js";
import libraryLoader from "../../services/library_loader.js";

const TPL = `
<div class="note-detail-image note-detail-printable">
    <style>
        .type-image .note-detail {
            height: 100%;
        }
    
        .note-detail-image {
            height: 100%; 
        }
        
        .note-detail-image-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            overflow: hidden;
            justify-content: center;
            height: 100%;
        }
        
        .note-detail-image-view {
            display: block;
            width: auto;
            height: auto;
            align-self: center;
            flex-shrink: 0;
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
        this.$imageWrapper = this.$widget.find('.note-detail-image-wrapper');
        this.$imageView = this.$widget.find('.note-detail-image-view')
            .attr("id", "image-view-" + utils.randomString(10));

        libraryLoader.requireLibrary(libraryLoader.WHEEL_ZOOM).then(() => {
            WZoom.create('#' + this.$imageView.attr("id"), {
                maxScale: 10,
                speed: 20,
                zoomOnClick: false
            });
        });

        super.doRender();
    }

    async doRefresh(note) {
        this.$imageView.prop("src", `api/images/${note.noteId}/${note.title}`);
    }

    copyImageToClipboardEvent({ntxId}) {
        if (!this.isNoteContext(ntxId)) {
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
