import bundleService from "./bundle.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";

const $noteDetailRender = $('#note-detail-render');

async function show() {
    $noteDetailRender.show();

    const bundle = await server.get('script/bundle/' + noteDetailService.getCurrentNoteId());

    $noteDetailRender.html(bundle.html);

    await bundleService.executeBundle(bundle);
}

export default {
    show,
    getContent: () => null,
    focus: () => null
}