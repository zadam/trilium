import server from "./server.js";
import noteDetailService from "./note_detail.js";

const $noteDetailRelationMap = $("#note-detail-relation-map");

async function render() {
    $noteDetailRelationMap.show();
}

export default {
    show: render,
    getContent: () => "",
    focus: () => null,
    onNoteChange: () => null
}