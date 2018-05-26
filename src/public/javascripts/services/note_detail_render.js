import bundleService from "./bundle.js";
import server from "./server.js";
import noteDetailService from "./note_detail.js";
import noteDetailCodeService from "./note_detail_code.js";

const $noteDetailCode = $('#note-detail-code');
const $noteDetailRender = $('#note-detail-render');
const $toggleEditButton = $('#toggle-edit-button');
const $renderButton = $('#render-button');

let codeEditorInitialized;

async function show() {
    codeEditorInitialized = false;

    $noteDetailRender.show();

    await render();
}

$toggleEditButton.click(() => {
    if ($noteDetailCode.is(":visible")) {
        $noteDetailCode.hide();
    }
    else {
        if (!codeEditorInitialized) {
            noteDetailCodeService.show();

            codeEditorInitialized = true;
        }
        else {
            $noteDetailCode.show();
        }
    }
});

$renderButton.click(render);

async function render() {
    // ctrl+enter is also used elsewhere so make sure we're running only when appropriate
    if (noteDetailService.getCurrentNoteType() !== 'render') {
        return;
    }

    if (codeEditorInitialized) {
        await noteDetailService.saveNoteIfChanged();
    }

    const bundle = await server.get('script/bundle/' + noteDetailService.getCurrentNoteId());

    $noteDetailRender.html(bundle.html);

    await bundleService.executeBundle(bundle);
}

$(document).bind('keydown', "ctrl+return", render);

export default {
    show,
    getContent: noteDetailCodeService.getContent,
    focus: () => null
}