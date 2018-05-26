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

    // if the note is empty, it doesn't make sense to do render-only since nothing will be rendered
    if (!noteDetailService.getCurrentNote().content.trim()) {
        toggleEdit();
    }

    $noteDetailRender.show();

    await render();
}

async function toggleEdit() {
    if ($noteDetailCode.is(":visible")) {
        $noteDetailCode.hide();
    }
    else {
        if (!codeEditorInitialized) {
            await noteDetailCodeService.show();

            // because we can't properly scroll only the editor without scrolling the rendering
            // we limit its height
            $noteDetailCode.find('.CodeMirror').css('height', '300');

            codeEditorInitialized = true;
        }
        else {
            $noteDetailCode.show();
        }
    }
}

$toggleEditButton.click(toggleEdit);

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