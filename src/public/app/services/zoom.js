import options from "./options.js";
import Component from "../widgets/component.js";
import utils from "../services/utils.js";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

class ZoomService extends Component {
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

        const webFrame = utils.dynamicRequire('electron').webFrame;
        webFrame.setZoomFactor(zoomFactor);
    }

    async setZoomFactorAndSave(zoomFactor) {
        if (zoomFactor >= MIN_ZOOM && zoomFactor <= MAX_ZOOM) {
            zoomFactor = Math.round(zoomFactor * 1000) / 1000;

            this.setZoomFactor(zoomFactor);

            await options.save('zoomFactor', zoomFactor);
        }
        else {
            console.log(`Zoom factor ${zoomFactor} outside of the range, ignored.`);
        }
    }

    getCurrentZoom() {
        return utils.dynamicRequire('electron').webFrame.getZoomFactor();
    }

    zoomOutEvent() {
        this.setZoomFactorAndSave(this.getCurrentZoom() - 0.1);
    }

    zoomInEvent() {
        this.setZoomFactorAndSave(this.getCurrentZoom() + 0.1);
    }

    setZoomFactorAndSaveEvent({zoomFactor}) {
        this.setZoomFactorAndSave(zoomFactor);
    }
}

const zoomService = new ZoomService();

export default zoomService;
