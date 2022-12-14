import ws from "./ws.js";
import appContext from "../components/app_context.js";

const fileModificationStatus = {};

function getFileModificationStatus(noteId) {
    return fileModificationStatus[noteId];
}

function fileModificationUploaded(noteId) {
    delete fileModificationStatus[noteId];
}

function ignoreModification(noteId) {
    delete fileModificationStatus[noteId];
}

ws.subscribeToMessages(async message => {
    if (message.type !== 'openedFileUpdated') {
        return;
    }

    fileModificationStatus[message.noteId] = message;

    appContext.triggerEvent('openedFileUpdated', {
        noteId: message.noteId,
        lastModifiedMs: message.lastModifiedMs,
        filePath: message.filePath
    });
});

export default {
    getFileModificationStatus,
    fileModificationUploaded,
    ignoreModification
}
