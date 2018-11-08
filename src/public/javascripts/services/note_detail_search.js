import noteDetailService from "./note_detail.js";

const $searchString = $("#search-string");
const $component = $('#note-detail-search');

function getContent() {
    JSON.stringify({
        searchString: $searchString.val()
    });
}

function show() {
    $component.show();

    try {
        const json = JSON.parse(noteDetailService.getCurrentNote().content);

        $searchString.val(json.searchString);
    }
    catch (e) {
        console.log(e);
        $searchString.val('');
    }

    $searchString.on('input', noteDetailService.noteChanged);
}

export default {
    getContent,
    show,
    focus: () => null,
    onNoteChange: () => null,
    cleanup: () => null
}