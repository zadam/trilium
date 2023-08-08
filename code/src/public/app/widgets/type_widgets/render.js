import renderService from "../../services/render.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-render note-detail-printable">
    <style>
        .note-detail-render {
            position: relative;
        }
    </style>

    <div class="note-detail-render-help alert alert-warning" style="margin: 50px; padding: 20px;">
        <p><strong>This help note is shown because this note of type Render HTML doesn't have required relation to function properly.</strong></p>

        <p>Render HTML note type is used for <a class="external" href="https://github.com/zadam/trilium/wiki/Scripts">scripting</a>. In short, you have a HTML code note (optionally with some JavaScript) and this note will render it. To make it work, you need to define a <a class="external" href="https://github.com/zadam/trilium/wiki/Attributes">relation</a> called "renderNote" pointing to the HTML note to render.</p>
    </div>

    <div class="note-detail-render-content"></div>
</div>`;

export default class RenderTypeWidget extends TypeWidget {
    static getType() { return "render"; }

    doRender() {
        this.$widget = $(TPL);
        this.$noteDetailRenderHelp = this.$widget.find('.note-detail-render-help');
        this.$noteDetailRenderContent = this.$widget.find('.note-detail-render-content');

        super.doRender();
    }

    async doRefresh(note) {
        this.$widget.show();
        this.$noteDetailRenderHelp.hide();

        const renderNotesFound = await renderService.render(note, this.$noteDetailRenderContent);

        if (!renderNotesFound) {
            this.$noteDetailRenderHelp.show();
        }
    }

    cleanup() {
        this.$noteDetailRenderContent.empty();
    }

    renderActiveNoteEvent() {
        if (this.noteContext.isActive()) {
            this.refresh();
        }
    }

    async executeWithContentElementEvent({resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        resolve(this.$noteDetailRenderContent);
    }
}
