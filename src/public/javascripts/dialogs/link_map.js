import server from '../services/server.js';
import noteDetailService from "../services/note_detail.js";

const $dialog = $("#link-map-dialog");

async function showDialog() {
    glob.activeDialog = $dialog;

    const noteId = noteDetailService.getActiveNoteId();

    const links = await server.get(`notes/${noteId}/links`);

    console.log(links);

    $dialog.modal();
}

export default {
    showDialog
};