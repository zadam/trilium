import optionsInit from './options_init.js';
import server from "./server.js";

let hoistedNoteId;

optionsInit.optionsReady.then(options => {
    hoistedNoteId = options['hoistedNoteId'];
});

async function getHoistedNoteId() {
    await optionsInit.optionsReady;

    return hoistedNoteId;
}

async function setHoistedNoteId(noteId) {
    hoistedNoteId = noteId;

    await server.put('options/hoistedNoteId/' + noteId);
}

export default {
    getHoistedNoteId,
    setHoistedNoteId
}