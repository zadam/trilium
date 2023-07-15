import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Table of Contents</h4>
    
    Table of contents will appear in text notes when the note has more than a defined number of headings. You can customize this number:
    
    <div class="form-group">
        <input type="number" class="min-toc-headings form-control options-number-input options-number-input" min="0" max="9999999999999999" step="1" />
    </div>
    
    <p>You can also use this option to effectively disable TOC by setting a very high number.</p>
</div>`;

export default class TableOfContentsOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$minTocHeadings = this.$widget.find(".min-toc-headings");
        this.$minTocHeadings.on('change', () =>
            this.updateOption('minTocHeadings', this.$minTocHeadings.val()));
    }

    async optionsLoaded(options) {
        this.$minTocHeadings.val(options.minTocHeadings);
    }
}
