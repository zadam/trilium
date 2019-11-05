import optionsService from './options.js';
import server from "./server.js";
import tree from "./tree.js";
import noteDetailService from "./note_detail.js";

let hoistedNoteId = 'root';

optionsService.waitForOptions().then(options => {
    hoistedNoteId = options.get('hoistedNoteId');
});

function getHoistedNoteNoPromise() {
    return hoistedNoteId;
}

async function getHoistedNoteId() {
    await optionsService.waitForOptions();

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
    getHoistedNoteNoPromise,
    setHoistedNoteId,
    unhoist,
    isTopLevelNode,
    isRootNode
}