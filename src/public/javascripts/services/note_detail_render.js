import bundleService from "./bundle.js";
import server from "./server.js";

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

        this.$renderButton.click(() => this.render()); // long form!
    }

    async render() {
        const attributes = await this.ctx.attributes.getAttributes();
        const renderNotes = attributes.filter(attr =>
            attr.type === 'relation'
            && attr.name === 'renderNote'
            && !!attr.value);

        this.$component.show();

        this.$noteDetailRenderContent.empty();
        this.$noteDetailRenderContent.toggle(renderNotes.length > 0);
        this.$noteDetailRenderHelp.toggle(renderNotes.length === 0);

        for (const renderNote of renderNotes) {
            const bundle = await server.get('script/bundle/' + renderNote.value);

            this.$noteDetailRenderContent.append(bundle.html);

            const $result = await bundleService.executeBundle(bundle, this.ctx.note, this.ctx);

            if ($result) {
                this.$noteDetailRenderContent.append($result);
            }
        }
    }

    getContent() {}

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