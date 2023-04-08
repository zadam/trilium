import OptionsWidget from "../options_widget.js";
import utils from "../../../../services/utils.js";

const FONT_FAMILIES = [
    { value: "theme", label: "Theme defined" },
    { value: "serif", label: "Serif" },
    { value: "sans-serif", label: "Sans Serif" },
    { value: "monospace", label: "Monospace" },
    { value: "Arial", label: "Arial" },
    { value: "Verdana", label: "Verdana" },
    { value: "Helvetica", label: "Helvetica" },
    { value: "Tahoma", label: "Tahoma" },
    { value: "Trebuchet MS", label: "Trebuchet MS" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Georgia", label: "Georgia" },
    { value: "Garamond", label: "Garamond" },
    { value: "Courier New", label: "Courier New" },
    { value: "Brush Script MT", label: "Brush Script MT" },
    { value: "Impact", label: "Impact" },
    { value: "American Typewriter", label: "American Typewriter" },
    { value: "Andalé Mono", label: "Andalé Mono" },
    { value: "Lucida Console", label: "Lucida Console" },
    { value: "Monaco", label: "Monaco" },
    { value: "Bradley Hand", label: "Bradley Hand" },
    { value: "Luminari", label: "Luminari" },
    { value: "Comic Sans MS", label: "Comic Sans MS" },
    { value: "Microsoft YaHei", label: "Microsoft YaHei" },
];

const TPL = `
<div class="options-section">
    <h4>Fonts</h4>
    
    <h5>Main font</h5>
    
    <div class="form-group row">
        <div class="col-6">
            <label>Font family</label>
            <select class="main-font-family form-control"></select>
        </div>
    
        <div class="col-6">
            <label>Size</label>

            <div class="input-group">
                <input type="number" class="main-font-size form-control" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>
    </div>

    <h5>Note tree font</h5>

    <div class="form-group row">
        <div class="col-4">
            <label>Font family</label>
            <select class="tree-font-family form-control"></select>
        </div>
    
        <div class="col-4">
            <label>Size</label>

            <div class="input-group">
                <input type="number" class="tree-font-size form-control" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>
    </div>
    
    <h5>Note detail font</h5>
    
    <div class="form-group row">
        <div class="col-4">
            <label>Font family</label>
            <select class="detail-font-family form-control"></select>
        </div>
        
        <div class="col-4">
            <label>Size</label>

            <div class="input-group">
                <input type="number" class="detail-font-size form-control" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>
    </div>
    
    <h5>Monospace (code) font</h5>
    
    <div class="form-group row">
        <div class="col-4">
            <label>Font family</label>
            <select class="monospace-font-family form-control"></select>
        </div>
    
        <div class="col-4">
            <label>Size</label>

            <div class="input-group">
                <input type="number" class="monospace-font-size form-control" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>
    </div>

    <p>Note that tree and detail font sizing is relative to the main font size setting.</p>

    <p>Not all listed fonts may be available on your system.</p>
    
    <p>
        To apply font changes, click on 
        <button class="btn btn-micro reload-frontend-button">reload frontend</button>
    </p>
</div>`;

export default class FontsOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$mainFontSize = this.$widget.find(".main-font-size");
        this.$mainFontFamily = this.$widget.find(".main-font-family");

        this.$treeFontSize = this.$widget.find(".tree-font-size");
        this.$treeFontFamily = this.$widget.find(".tree-font-family");

        this.$detailFontSize = this.$widget.find(".detail-font-size");
        this.$detailFontFamily = this.$widget.find(".detail-font-family");

        this.$monospaceFontSize = this.$widget.find(".monospace-font-size");
        this.$monospaceFontFamily = this.$widget.find(".monospace-font-family");

        this.$widget.find(".reload-frontend-button").on("click", () => utils.reloadFrontendApp("changes from appearance options"));
    }

    async optionsLoaded(options) {
        if (options.overrideThemeFonts !== 'true') {
            this.toggleInt(false);
            return;
        }

        this.toggleInt(true);

        this.$mainFontSize.val(options.mainFontSize);
        this.fillFontFamilyOptions(this.$mainFontFamily, options.mainFontFamily);

        this.$treeFontSize.val(options.treeFontSize);
        this.fillFontFamilyOptions(this.$treeFontFamily, options.treeFontFamily);

        this.$detailFontSize.val(options.detailFontSize);
        this.fillFontFamilyOptions(this.$detailFontFamily, options.detailFontFamily);

        this.$monospaceFontSize.val(options.monospaceFontSize);
        this.fillFontFamilyOptions(this.$monospaceFontFamily, options.monospaceFontFamily);

        const optionsToSave = [
            'mainFontFamily', 'mainFontSize',
            'treeFontFamily', 'treeFontSize',
            'detailFontFamily', 'detailFontSize',
            'monospaceFontFamily', 'monospaceFontSize'
        ];

        for (const optionName of optionsToSave) {
            this[`$${optionName}`].on('change', () =>
                this.updateOption(optionName, this[`$${optionName}`].val()));
        }
    }

    fillFontFamilyOptions($select, currentValue) {
        $select.empty();

        for (const {value, label} of FONT_FAMILIES) {
            $select.append($("<option>")
                .attr("value", value)
                .prop("selected", value === currentValue)
                .text(label));
        }
    }
}
