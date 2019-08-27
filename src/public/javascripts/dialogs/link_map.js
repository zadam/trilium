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

    const note = noteDetailService.getActiveNote();

    if (!note) {
        return;
    }

    $linkMapContainer.css("height", $("body").height() - 150);

    linkMapService = new LinkMapService(note, $linkMapContainer, getOptions());

    linkMapService.render();

    $dialog.modal();
}

$maxNotesInput.on("input", () => linkMapService.loadNotesAndRelations(getOptions()));
