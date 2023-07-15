import OptionsWidget from "../options_widget.js";
import utils from "../../../../services/utils.js";

const TPL = `
<div class="options-section">
    <h4>Content Width</h4>
    
    <p>Trilium by default limits max content width to improve readability for maximized screens on wide screens.</p>
    
    <div class="form-group row">
        <div class="col-4">
            <label>Max content width in pixels</label>
            <input type="number" min="200" step="10" class="max-content-width form-control options-number-input">
        </div>
    </div>
    
    <p>
        To apply content width changes, click on 
        <button class="btn btn-micro reload-frontend-button">reload frontend</button>
    </p>
</div>`;

export default class MaxContentWidthOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$maxContentWidth = this.$widget.find(".max-content-width");

        this.$maxContentWidth.on('change', async () =>
            this.updateOption('maxContentWidth', this.$maxContentWidth.val()))

        this.$widget.find(".reload-frontend-button").on("click", () => utils.reloadFrontendApp("changes from appearance options"));
    }

    async optionsLoaded(options) {
        this.$maxContentWidth.val(options.maxContentWidth);
    }
}
