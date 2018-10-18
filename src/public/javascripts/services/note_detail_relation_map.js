import server from "./server.js";
import noteDetailService from "./note_detail.js";
import libraryLoader from "./library_loader.js";

const $noteDetailRelationMap = $("#note-detail-relation-map");

async function show() {
    $noteDetailRelationMap.show();

    await libraryLoader.requireLibrary(libraryLoader.RELATION_MAP);
}

export default {
    show,
    getContent: () => "",
    focus: () => null,
    onNoteChange: () => null
}