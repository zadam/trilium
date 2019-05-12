import server from "./server.js";
import utils from "./utils.js";
import optionsInitService from "./options_init.js";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

async function decreaseZoomFactor() {
    await setZoomFactorAndSave(getCurrentZoom() - 0.1);
}

async function increaseZoomFactor() {
    await setZoomFactorAndSave(getCurrentZoom() + 0.1);
}

function setZoomFactor(zoomFactor) {
    zoomFactor = parseFloat(zoomFactor);

    const webFrame = require('electron').webFrame;
    webFrame.setZoomFactor(zoomFactor);
}

async function setZoomFactorAndSave(zoomFactor) {
    if (!utils.isElectron()) {
        return;
    }

    if (zoomFactor >= MIN_ZOOM && zoomFactor <= MAX_ZOOM) {
        setZoomFactor(zoomFactor);

        await server.put('options/zoomFactor/' + zoomFactor);
    }
    else {
        console.log(`Zoom factor ${zoomFactor} outside of the range, ignored.`);
    }
}

function getCurrentZoom() {
    return require('electron').webFrame.getZoomFactor();
}

if (utils.isElectron()) {
    optionsInitService.addLoadListener(options => setZoomFactor(options.zoomFactor))
}

export default {
    decreaseZoomFactor,
    increaseZoomFactor,
    setZoomFactor,
    setZoomFactorAndSave
}