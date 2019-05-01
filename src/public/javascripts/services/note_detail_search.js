import noteDetailService from "./note_detail.js";
import searchNotesService from "./search_notes.js";

const $searchString = $("#search-string");
const $component = $('#note-detail-search');
const $refreshButton = $('#note-detail-search-refresh-results-button');
const $help = $("#note-detail-search-help");

function show() {
    $help.html(searchNotesService.getHelpText());

    $component.show();

    try {
        const json = JSON.parse(noteDetailService.getActiveNote().content);

        $searchString.val(json.searchString);
    }
    catch (e) {
        console.log(e);
        $searchString.val('');
    }

    $searchString.on('input', noteDetailService.noteChanged);
}

function getContent() {
    return JSON.stringify({
        searchString: $searchString.val()
    });
}

$refreshButton.click(async () => {
    await noteDetailService.saveNotesIfChanged();

    await searchNotesService.refreshSearch();
});

export default {
    getContent,
    show,
    focus: () => null,
    onNoteChange: () => null,
    cleanup: () => null,
    scrollToTop: () => null
}