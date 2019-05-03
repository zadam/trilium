import bundleService from "./bundle.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";
import attributeService from "./attributes.js";

class NoteDetailRender {
    /**
     * @param {NoteContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$noteTabContent.find('.note-detail-render');
        this.$noteDetailRenderHelp = ctx.$noteTabContent.find('.note-detail-render-help');
        this.$noteDetailRenderContent = ctx.$noteTabContent.find('.note-detail-render-content');
        this.$renderButton = ctx.$noteTabContent.find('.render-button');

        this.$renderButton.click(this.show);
    }

    async show() {
        const attributes = await attributeService.getAttributes();
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

            await bundleService.executeBundle(bundle, noteDetailService.getActiveNote());
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