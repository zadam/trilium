import renderService from "./render.js";

class NoteDetailRender {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find('.note-detail-render');
        this.$noteDetailRenderHelp = ctx.$tabContent.find('.note-detail-render-help');
        this.$noteDetailRenderContent = ctx.$tabContent.find('.note-detail-render-content');
        this.$renderButton = ctx.$tabContent.find('.render-button');

        this.$renderButton.on('click', () => this.render()); // long form!
    }

    async render() {
        this.$component.show();
        this.$noteDetailRenderHelp.hide();

        await renderService.render(this.ctx.note, this.$noteDetailRenderContent, this.ctx);
    }

    getContent() {}

    show() {}

    focus() {}

    onNoteChange() {}

    cleanup() {
        this.$noteDetailRenderContent.empty();
    }

    scrollToTop() {
        this.$component.scrollTop(0);
    }
}

export default NoteDetailRender;