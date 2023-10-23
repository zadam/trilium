import utils from "../../services/utils.js";
import TypeWidget from "./type_widget.js";
import libraryLoader from "../../services/library_loader.js";
import contextMenu from "../../menus/context_menu.js";
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

        if (utils.isElectron()) {
            // for browser, we want to let the native menu
            this.$imageView.on('contextmenu', e => {
                e.preventDefault();

                contextMenu.show({
                    x: e.pageX,
                    y: e.pageY,
                    items: [
                        {
                            title: "Copy reference to clipboard",
                            command: "copyImageReferenceToClipboard",
                            uiIcon: "bx bx-empty"
                        },
                        {title: "Copy image to clipboard", command: "copyImageToClipboard", uiIcon: "bx bx-empty"},
                    ],
                    selectMenuItemHandler: ({command}) => {
                        if (command === 'copyImageReferenceToClipboard') {
                            imageService.copyImageReferenceToClipboard(this.$imageWrapper);
                        } else if (command === 'copyImageToClipboard') {
                            const webContents = utils.dynamicRequire('@electron/remote').getCurrentWebContents();
                            utils.dynamicRequire('electron');
                            webContents.copyImageAt(e.pageX, e.pageY);
                        } else {
                            throw new Error(`Unrecognized command '${command}'`);
                        }
                    }
                });
            });
        }

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
