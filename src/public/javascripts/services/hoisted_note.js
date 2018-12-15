import optionsInit from './options_init.js';
import server from "./server.js";
import tree from "./tree.js";

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

    await tree.reload();
}

async function unhoist() {
    await setHoistedNoteId('root');
}

export default {
    getHoistedNoteId,
    setHoistedNoteId,
    unhoist
}