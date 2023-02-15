import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Extract text from PDF files</h4>
    
    <label>
        <input class="extract-text-from-pdf" type="checkbox">
        Extract text from PDF
    </label>
    
    <p>Text extracted from PDFs will be considered when fulltext searching.</p>
</div>
`;

export default class ExtractTextFromPdfOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$extractTextFromPdf = this.$widget.find(".extract-text-from-pdf");
        this.$extractTextFromPdf.on("change", () =>
            this.updateCheckboxOption('extractTextFromPdf', this.$extractTextFromPdf));
    }

    optionsLoaded(options) {
        this.setCheckboxState(this.$extractTextFromPdf, options.extractTextFromPdf);
    }
}
