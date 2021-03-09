import appContext from "./app_context.js";
import treeService from "./tree.js";

function getHoistedNoteId() {
    const activeTabContext = appContext.tabManager.getActiveTabContext();

    return activeTabContext ? activeTabContext.hoistedNoteId : 'root';
}

async function unhoist() {
    const activeTabContext = appContext.tabManager.getActiveTabContext();

    if (activeTabContext) {
        await activeTabContext.unhoist();
    }
}

function isTopLevelNode(node) {
    return isHoistedNode(node.getParent());
}

function isHoistedNode(node) {
    // even though check for 'root' should not be necessary, we keep it just in case
    return node.data.noteId === "root"
        || node.data.noteId === getHoistedNoteId();
}

async function checkNoteAccess(notePath, tabContext) {
    const resolvedNotePath = await treeService.resolveNotePath(notePath, tabContext.hoistedNoteId);

    if (!resolvedNotePath) {
        console.log("Cannot activate " + notePath);
        return false;
    }

    const hoistedNoteId = tabContext.hoistedNoteId;

    if (!resolvedNotePath.includes(hoistedNoteId)) {
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
    unhoist,
    isTopLevelNode,
    isHoistedNode,
    checkNoteAccess
}
