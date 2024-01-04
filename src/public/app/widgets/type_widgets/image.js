import utils from "../../services/utils.js";
import TypeWidget from "./type_widget.js";
import libraryLoader from "../../services/library_loader.js";
import imageContextMenuService from "../../menus/image_context_menu.js";
import imageService from "../../services/image.js";

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
            .attr("id", `image-view-${utils.randomString(10)}`);

        libraryLoader.requireLibrary(libraryLoader.WHEEL_ZOOM).then(() => {
            WZoom.create(`#${this.$imageView.attr("id")}`, {
                maxScale: 50,
                speed: 1.3,
                zoomOnClick: false
            });
        });

        imageContextMenuService.setupContextMenu(this.$imageView);

        super.doRender();
    }

    async doRefresh(note) {
        this.$imageView.prop("src", utils.createImageSrcUrl(note));
    }

    copyImageReferenceToClipboardEvent({ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        imageService.copyImageReferenceToClipboard(this.$imageWrapper);
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}

export default ImageTypeWidget
