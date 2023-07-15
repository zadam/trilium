import appContext from "../../../../components/app_context.js";
import OptionsWidget from "../options_widget.js";
import utils from "../../../../services/utils.js";

const TPL = `
<div class="options-section">
    <h4>Zoom Factor (desktop build only)</h4>

    <input type="number" class="zoom-factor-select form-control options-number-input" min="0.3" max="2.0" step="0.1"/>
    <p>Zooming can be controlled with CTRL+- and CTRL+= shortcuts as well.</p>
</div>`;

export default class ZoomFactorOptions extends OptionsWidget {
    isEnabled() {
        return super.isEnabled() && utils.isElectron();
    }

    doRender() {
        this.$widget = $(TPL);
        this.$zoomFactorSelect = this.$widget.find(".zoom-factor-select");
        this.$zoomFactorSelect.on('change', () => { appContext.triggerCommand('setZoomFactorAndSave', {zoomFactor: this.$zoomFactorSelect.val()}); });
    }

    async optionsLoaded(options) {
        this.$zoomFactorSelect.val(options.zoomFactor);
    }
}
