import renderService from "../../services/render.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-render note-detail-printable">
    <div class="note-detail-render-help alert alert-warning">
        <p><strong>This help note is shown because this note of type Render HTML doesn't have required relation to function properly.</strong></p>

        <p>Render HTML note type is used for <a href="https://github.com/zadam/trilium/wiki/Scripts">scripting</a>. In short, you have a HTML code note (optionally with some JavaScript) and this note will render it. To make it work, you need to define a relation (in <a class="show-attributes-button">Attributes dialog</a>) called "renderNote" pointing to the HTML note to render. Once that's defined you can click on the "play" button to render.</p>
    </div>

    <div class="note-detail-render-content"></div>
</div>`;

export default class RenderTypeWidget extends TypeWidget {
    static getType() { return "render"; }

    doRender() {
        this.$widget = $(TPL);
        this.$noteDetailRenderHelp = this.$widget.find('.note-detail-render-help');
        this.$noteDetailRenderContent = this.$widget.find('.note-detail-render-content');
        this.$renderButton = this.$widget.find('.render-button');

        this.$renderButton.on('click', () => this.render()); // long form!

        return this.$widget;
    }

    async doRefresh(note) {
        this.$widget.show();
        this.$noteDetailRenderHelp.hide();

        // FIXME this.ctx
        const renderNotesFound = await renderService.render(note, this.$noteDetailRenderContent, this.ctx);

        if (!renderNotesFound) {
            this.$noteDetailRenderHelp.show();
        }
    }

    getContent() {}

    focus() {}

    cleanup() {
        this.$noteDetailRenderContent.empty();
    }

    scrollToTop() {
        this.$widget.scrollTop(0);
    }
}