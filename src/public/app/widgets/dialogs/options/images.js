import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";

const TPL = `
<div>
    <h4>Images</h4>
    
    <div class="form-group">
        <input id="download-images-automatically" type="checkbox" name="download-images-automatically">
        <label for="download-images-automatically">Download images automatically for offline use.</label>
        <p>(pasted HTML can contain references to online images, Trilium will find those references and download the images so that they are available offline)</p>
    </div>
    
    <div class="form-group">
        <input id="image-compresion-enabled" type="checkbox" name="image-compression-enabled">
        <label for="image-compresion-enabled">Enable image compression</label>
    </div>

    <div id="image-compression-enabled-wraper">
        <div class="form-group">
            <label for="image-max-width-height">Max width / height of an image in pixels (image will be resized if it exceeds this setting).</label>
            <input class="form-control" id="image-max-width-height" type="number" min="1">
        </div>
    
        <div class="form-group">
            <label for="image-jpeg-quality">JPEG quality (10 - worst quality, 100 best quality, 50 - 85 is recommended)</label>
            <input class="form-control" id="image-jpeg-quality" min="10" max="100" type="number">
        </div>
    </div>
</div>
`;

export default class ImageOptions {
    constructor() {
        $("#options-images").html(TPL);

        this.$imageMaxWidthHeight = $("#image-max-width-height");
        this.$imageJpegQuality = $("#image-jpeg-quality");

        this.$imageMaxWidthHeight.on('change', () => {
            const opts = { 'imageMaxWidthHeight': this.$imageMaxWidthHeight.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$imageJpegQuality.on('change', () => {
            const opts = { 'imageJpegQuality': this.$imageJpegQuality.val() };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$downloadImagesAutomatically = $("#download-images-automatically");

        this.$downloadImagesAutomatically.on("change", () => {
            const isChecked = this.$downloadImagesAutomatically.prop("checked");
            const opts = { 'downloadImagesAutomatically': isChecked ? 'true' : 'false' };

            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));
        });

        this.$enableImageCompression = $("#image-compresion-enabled");
        this.$imageCompressionWrapper = $("#image-compression-enabled-wraper");

        this.setImageCompression = (isChecked) => {
            if (isChecked) {
                this.$imageCompressionWrapper.removeClass("disabled-field");
            } else {
                this.$imageCompressionWrapper.addClass("disabled-field");
            }
        };

        this.$enableImageCompression.on("change", () => {
            const isChecked = this.$enableImageCompression.prop("checked");
            const opts = { 'compressImages': isChecked ? 'true' : 'false' };

            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            this.setImageCompression(isChecked);
        });
    }

    optionsLoaded(options) {
        this.$imageMaxWidthHeight.val(options['imageMaxWidthHeight']);
        this.$imageJpegQuality.val(options['imageJpegQuality']);

        const downloadImagesAutomatically = options['downloadImagesAutomatically'] === 'true';
        this.$downloadImagesAutomatically.prop('checked', downloadImagesAutomatically);

        const compressImages = options['compressImages'] === 'true';
        this.$enableImageCompression.prop('checked', compressImages);
        this.setImageCompression(compressImages);
    }
}
