import utils from "../services/utils.js";
import contextMenu from "./context_menu.js";
import imageService from "../services/image.js";

const PROP_NAME = "imageContextMenuInstalled";

function setupContextMenu($image) {
    if (!utils.isElectron() || $image.prop(PROP_NAME)) {
        return;
    }

    $image.prop(PROP_NAME, true);
    $image.on('contextmenu', e => {
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
                    imageService.copyImageReferenceToClipboard($image);
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

export default {
    setupContextMenu
};
