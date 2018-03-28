import bundleService from "./bundle.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";

const $noteDetailRender = $('#note-detail-render');

async function showRenderNote() {
    $noteDetailRender.show();

    const bundle = await server.get('script/bundle/' + noteDetailService.getCurrentNoteId());

    $noteDetailRender.html(bundle.html);

    await bundleService.executeBundle(bundle);
}

export default {
    showRenderNote,
    getContent: () => null,
    focus: () => null
}