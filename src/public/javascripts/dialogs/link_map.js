import utils from "../services/utils.js";
import LinkMapService from "../services/link_map.js";
import noteDetailService from "../services/note_detail.js";

const $linkMapContainer = $("#link-map-container");

const $dialog = $("#link-map-dialog");
const $maxNotesInput = $("#link-map-max-notes");

let linkMapService;

function getOptions() {
    return {
        maxNotes: $maxNotesInput.val()
    };
}

export async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    // set default settings
    $maxNotesInput.val(20);

    $linkMapContainer.css("height", $("body").height() - 150);

    $linkMapContainer.empty();

    $dialog.modal();
}

$dialog.on('shown.bs.modal', () => {
    const note = noteDetailService.getActiveTabNote();

    linkMapService = new LinkMapService(note, $linkMapContainer, getOptions());
    linkMapService.render();
});

$maxNotesInput.on("input", () => linkMapService.loadNotesAndRelations(getOptions()));
