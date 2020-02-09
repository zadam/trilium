import utils from "../services/utils.js";
import LinkMapService from "../services/link_map.js";
import appContext from "../services/app_context.js";

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
    // set default settings
    $maxNotesInput.val(20);

    $linkMapContainer.css("height", $("body").height() - 150);

    $linkMapContainer.empty();

    utils.openDialog($dialog);
}

$dialog.on('shown.bs.modal', () => {
    const note = appContext.tabManager.getActiveTabNote();

    linkMapService = new LinkMapService(note, $linkMapContainer, getOptions());
    linkMapService.render();
});

$maxNotesInput.on("input", () => linkMapService.loadNotesAndRelations(getOptions()));
