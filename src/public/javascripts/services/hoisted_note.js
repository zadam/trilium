import optionsService from './options.js';
import server from "./server.js";
import appContext from "./app_context.js";
import treeService from "./tree.js";

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
    hoistedNoteId = noteId;

    await server.put('options/hoistedNoteId/' + noteId);

    appContext.trigger('hoistedNoteChanged', {hoistedNoteId});
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

async function checkNoteAccess(notePath) {
    // notePath argument can contain only noteId which is not good when hoisted since
    // then we need to check the whole note path
    const runNotePath = await treeService.getRunPath(notePath);

    if (!runNotePath) {
        console.log("Cannot activate " + notePath);
        return false;
    }

    const hoistedNoteId = await getHoistedNoteId();

    if (hoistedNoteId !== 'root' && !runNotePath.includes(hoistedNoteId)) {
        const confirmDialog = await import('../dialogs/confirm.js');

        if (!await confirmDialog.confirm("Requested note is outside of hoisted note subtree and you must unhoist to access the note. Do you want to proceed with unhoisting?")) {
            return false;
        }

        // unhoist so we can activate the note
        await unhoist();
    }

    return true;
}

export default {
    getHoistedNoteId,
    getHoistedNoteNoPromise,
    setHoistedNoteId,
    unhoist,
    isTopLevelNode,
    isRootNode,
    checkNoteAccess
}