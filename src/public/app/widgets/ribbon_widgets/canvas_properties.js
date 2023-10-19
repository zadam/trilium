import NoteContextAwareWidget from "../note_context_aware_widget.js";
import utils from "../../services/utils.js";
import imageService from "../../services/image.js";

const TPL = `
<div class="image-properties">
    <div style="display: flex; justify-content: space-evenly; margin: 10px;">
        <button class="canvas-copy-reference-to-clipboard btn btn-sm btn-primary" 
                title="Pasting this reference into a text note will insert the canvas note as image"
                type="button">Copy reference to clipboard</button>
    </div>
    
    <div class="hidden-canvas-copy"></div>
</div>`;

export default class CanvasPropertiesWidget extends NoteContextAwareWidget {
    get name() {
        return "canvasProperties";
    }

    get toggleCommand() {
        return "toggleRibbonTabCanvasProperties";
    }

    isEnabled() {
        return this.note && this.note.type === 'canvas';
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            activate: false,
            title: 'Canvas',
            icon: 'bx bx-pen'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$hiddenCanvasCopy = this.$widget.find('.hidden-canvas-copy');

        this.$copyReferenceToClipboardButton = this.$widget.find(".canvas-copy-reference-to-clipboard");
        this.$copyReferenceToClipboardButton.on('click', () => {
            this.$hiddenCanvasCopy.empty().append(
                $("<img>")
                    .attr("src", utils.createImageSrcUrl(this.note))
            );

            imageService.copyImageReferenceToClipboard(this.$hiddenCanvasCopy);

            this.$hiddenCanvasCopy.empty();
        });
    }
}
