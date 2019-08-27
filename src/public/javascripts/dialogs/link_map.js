import utils from "../services/utils.js";
import LinkMapService from "../services/link_map.js";
import noteDetailService from "../services/note_detail.js";

const $linkMapContainer = $("#link-map-container");

const LINK_TYPES = [ "hyper", "image", "relation", "relation-map" ];

const $dialog = $("#link-map-dialog");
const $maxNotesInput = $("#link-map-max-notes");

let linkMapService;

export async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    // set default settings
    $maxNotesInput.val(10);
    LINK_TYPES.forEach(lt => $("#link-map-" + lt).prop('checked', true));

    const note = noteDetailService.getActiveNote();

    if (!note) {
        return;
    }

    $linkMapContainer.css("height", $("body").height() - 150);

    linkMapService = new LinkMapService(note, $linkMapContainer);
    linkMapService.render();

    $dialog.modal();
}

$(".link-map-settings").change(() => linkMapService.loadNotesAndRelations());

$maxNotesInput.on("input", () => linkMapService.loadNotesAndRelations());
