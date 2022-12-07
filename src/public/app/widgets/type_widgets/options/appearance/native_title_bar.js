import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Native title bar (requires app restart)</h4>
    
    <select class="native-title-bar-select form-control">
        <option value="show">enabled</option>
        <option value="hide">disabled</option>
    </select>
</div>`;

export default class NativeTitleBarOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$nativeTitleBarSelect = this.$widget.find(".native-title-bar-select");
        this.$nativeTitleBarSelect.on('change', () => {
            const nativeTitleBarVisible = this.$nativeTitleBarSelect.val() === 'show' ? 'true' : 'false';

            this.updateOption('nativeTitleBarVisible', nativeTitleBarVisible);
        });
    }

    async optionsLoaded(options) {
        this.$nativeTitleBarSelect.val(options.nativeTitleBarVisible === 'true' ? 'show' : 'hide');
    }
}
