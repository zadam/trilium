import options from './options.js';
import appContext from "./app_context.js";
import treeService from "./tree.js";

function getHoistedNoteId() {
    return options.get('hoistedNoteId');
}

async function setHoistedNoteId(noteId) {
    await options.save('hoistedNoteId', noteId);

    // FIXME - just use option load event
    appContext.triggerEvent('hoistedNoteChanged', {noteId});
}

async function unhoist() {
    await setHoistedNoteId('root');
}

function isTopLevelNode(node) {
    return isRootNode(node.getParent());
}

function isRootNode(node) {
    // even though check for 'root' should not be necessary, we keep it just in case
    return node.data.noteId === "root"
        || node.data.noteId === getHoistedNoteId();
}

async function checkNoteAccess(notePath) {
    // notePath argument can contain only noteId which is not good when hoisted since
    // then we need to check the whole note path
    const runNotePath = await treeService.getRunPath(notePath);

    if (!runNotePath) {
        console.log("Cannot activate " + notePath);
        return false;
    }

    const hoistedNoteId = getHoistedNoteId();

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
    setHoistedNoteId,
    unhoist,
    isTopLevelNode,
    isRootNode,
    checkNoteAccess
}