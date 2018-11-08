import bundleService from "./bundle.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";
import attributeService from "./attributes.js";

const $component = $('#note-detail-render');
const $noteDetailRenderHelp = $('#note-detail-render-help');
const $noteDetailRenderContent = $('#note-detail-render-content');
const $renderButton = $('#render-button');

async function render() {
    const attributes = await attributeService.getAttributes();
    const renderNotes = attributes.filter(attr =>
        attr.type === 'relation'
        && attr.name === 'renderNote'
        && !!attr.value);

    $component.show();

    $noteDetailRenderContent.empty();
    $noteDetailRenderContent.toggle(renderNotes.length > 0);
    $noteDetailRenderHelp.toggle(renderNotes.length === 0);

    for (const renderNote of renderNotes) {
        const bundle = await server.get('script/bundle/' + renderNote.value);

        $noteDetailRenderContent.append(bundle.html);

        await bundleService.executeBundle(bundle, noteDetailService.getCurrentNote());
    }
}

$renderButton.click(render);

export default {
    show: render,
    getContent: () => "",
    focus: () => null,
    onNoteChange: () => null,
    cleanup: () => $noteDetailRenderContent.empty()
}