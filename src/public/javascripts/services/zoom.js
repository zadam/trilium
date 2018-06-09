import server from "./server.js";
import utils from "./utils.js";
import optionsInitService from "./options_init.js";

function decreaseZoomFactor() {
    const webFrame = require('electron').webFrame;

    if (webFrame.getZoomFactor() > 0.2) {
        const webFrame = require('electron').webFrame;
        const newZoomFactor = webFrame.getZoomFactor() - 0.1;

        webFrame.setZoomFactor(newZoomFactor);

        server.put('options/zoomFactor/' + newZoomFactor);
    }
}

function increaseZoomFactor() {
    const webFrame = require('electron').webFrame;
    const newZoomFactor = webFrame.getZoomFactor() + 0.1;

    webFrame.setZoomFactor(newZoomFactor);

    server.put('options/zoomFactor/' + newZoomFactor);
}

function setZoomFactor(zoomFactor) {
    zoomFactor = parseFloat(zoomFactor);

    const webFrame = require('electron').webFrame;
    webFrame.setZoomFactor(zoomFactor);
}

async function setZoomFactorAndSave(zoomFactor) {
    setZoomFactor(zoomFactor);

    await server.put('options/zoomFactor/' + zoomFactor);
}

if (utils.isElectron()) {
    optionsInitService.optionsReady.then(options => setZoomFactor(options.zoomFactor))
}

export default {
    decreaseZoomFactor,
    increaseZoomFactor,
    setZoomFactor,
    setZoomFactorAndSave
}