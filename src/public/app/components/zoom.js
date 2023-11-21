import options from "../services/options.js";
import Component from "./component.js";
import utils from "../services/utils.js";

import {webFrame} from "electron";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

class ZoomComponent extends Component {
    constructor() {
        super();

        if (utils.isElectron()) {
            options.initializedPromise.then(() => {
                this.setZoomFactor(options.getFloat('zoomFactor'));
            });

            window.addEventListener("wheel", event => {
                if (event.ctrlKey) {
                    this.setZoomFactorAndSave(this.getCurrentZoom() + event.deltaY * 0.001);
                }
            });
        }
    }

    setZoomFactor(zoomFactor) {
        zoomFactor = parseFloat(zoomFactor);
        webFrame.setZoomFactor(zoomFactor);
    }

    async setZoomFactorAndSave(zoomFactor) {
        if (zoomFactor >= MIN_ZOOM && zoomFactor <= MAX_ZOOM) {
            zoomFactor = Math.round(zoomFactor * 10) / 10;

            this.setZoomFactor(zoomFactor);

            await options.save('zoomFactor', zoomFactor);
        }
        else {
            console.log(`Zoom factor ${zoomFactor} outside of the range, ignored.`);
        }
    }

    getCurrentZoom() {
        return webFrame.getZoomFactor();
    }

    zoomOutEvent() {
        this.setZoomFactorAndSave(this.getCurrentZoom() - 0.1);
    }

    zoomInEvent() {
        this.setZoomFactorAndSave(this.getCurrentZoom() + 0.1);
    }
    zoomResetEvent() {
        this.setZoomFactorAndSave(1);
    }

    setZoomFactorAndSaveEvent({zoomFactor}) {
        this.setZoomFactorAndSave(zoomFactor);
    }
}

const zoomService = new ZoomComponent();

export default zoomService;
