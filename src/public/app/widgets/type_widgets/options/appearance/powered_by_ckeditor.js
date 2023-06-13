import OptionsWidget from "../options_widget.js";
import utils from "../../../../services/utils.js";

const TPL = `
<div class="options-section">
    <h4>Powered by CKEditor banner</h4>
    
    <p>CKEditor by default displays a small banner in the editing area. Some users may find this distracting, so it is possible to hide it.</p>
    
    <select class="powered-by-ckeditor-select form-control">
        <option value="show">shown</option>
        <option value="hide">hidden</option>
    </select>
</div>`;

export default class PoweredByCKEditorOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$poweredByCKEditorSelect = this.$widget.find(".powered-by-ckeditor-select");
        this.$poweredByCKEditorSelect.on('change', async () => {
            const hidePoweredByCKEditor = this.$poweredByCKEditorSelect.val() === 'hide' ? 'true' : 'false';

            await this.updateOption('hidePoweredByCKEditor', hidePoweredByCKEditor);

            utils.reloadFrontendApp("Powered by CKEditor change");
        });
    }

    async optionsLoaded(options) {
        this.$poweredByCKEditorSelect.val(options.hidePoweredByCKEditor === 'true' ? 'hide' : 'show');
    }
}
