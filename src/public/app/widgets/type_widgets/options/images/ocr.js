import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>OCR</h4>
    
    <label>
        <input class="ocr-images" type="checkbox">
        Extract text from images using OCR
    </label>
    
    <p>Text extracted from images will be considered when fulltext searching.</p>
</div>
`;

export default class OcrOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$ocrImages = this.$widget.find(".ocr-images");
        this.$ocrImages.on("change", () =>
            this.updateCheckboxOption('ocrImages', this.$ocrImages));
    }

    optionsLoaded(options) {
        this.setCheckboxState(this.$ocrImages, options.ocrImages);
    }
}
