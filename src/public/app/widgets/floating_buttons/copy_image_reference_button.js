import NoteContextAwareWidget from "../note_context_aware_widget.js";
import utils from "../../services/utils.js";
import imageService from "../../services/image.js";

const TPL = `
<button type="button"
        class="copy-image-reference-button"
        title="Copy image reference to the clipboard, can be pasted into a text note.">
        <span class="bx bx-copy"></span>
        
        <div class="hidden-image-copy"></div>
</button>`;

export default class CopyImageReferenceButton extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && ['mermaid', 'canvas'].includes(this.note?.type)
            && this.note.isContentAvailable()
            && this.noteContext?.viewScope.viewMode === 'default';
    }

    doRender() {
        super.doRender();

        this.$widget = $(TPL);
        this.$hiddenImageCopy = this.$widget.find(".hidden-image-copy");

        this.$widget.on('click', () => {
            this.$hiddenImageCopy.empty().append(
                $("<img>")
                    .attr("src", utils.createImageSrcUrl(this.note))
            );

            imageService.copyImageReferenceToClipboard(this.$hiddenImageCopy);

            this.$hiddenImageCopy.empty();
        });
        this.contentSized();
    }
}
