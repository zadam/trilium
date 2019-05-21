import optionsInit from './options_init.js';
import server from "./server.js";
import tree from "./tree.js";
import noteDetailService from "./note_detail.js";

let hoistedNoteId;

optionsInit.optionsReady.then(options => {
    hoistedNoteId = options['hoistedNoteId'];
});

async function getHoistedNoteId() {
    await optionsInit.optionsReady;

    return hoistedNoteId;
}

async function setHoistedNoteId(noteId) {
    if (noteId !== 'root') {
        await noteDetailService.filterTabs(noteId);
    }

    hoistedNoteId = noteId;

    await server.put('options/hoistedNoteId/' + noteId);

    await tree.reload();

    const activeTabContext = noteDetailService.getActiveTabContext();

    if (activeTabContext) {
        await tree.activateNote(activeTabContext.notePath);
    }
}

async function unhoist() {
    await setHoistedNoteId('root');
}

async function isTopLevelNode(node) {
    return await isRootNode(node.getParent());
}

async function isRootNode(node) {
    // even though check for 'root' should not be necessary, we keep it just in case
    return node.data.noteId === "root"
        || node.data.noteId === await getHoistedNoteId();
}

export default {
    getHoistedNoteId,
    setHoistedNoteId,
    unhoist,
    isTopLevelNode,
    isRootNode
}