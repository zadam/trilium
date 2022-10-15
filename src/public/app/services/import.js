import toastService from "./toast.js";
import server from "./server.js";
import ws from "./ws.js";
import utils from "./utils.js";
import appContext from "./app_context.js";

export async function uploadFiles(parentNoteId, files, options) {
    if (files.length === 0) {
        return;
    }

    const taskId = utils.randomString(10);
    let noteId;
    let counter = 0;

    for (const file of files) {
        counter++;

        const formData = new FormData();
        formData.append('upload', file);
        formData.append('taskId', taskId);
        formData.append('last', counter === files.length ? "true" : "false");

        for (const key in options) {
            formData.append(key, options[key]);
        }

        ({noteId} = await $.ajax({
            url: baseApiUrl + 'notes/' + parentNoteId + '/import',
            headers: await server.getHeaders(),
            data: formData,
            dataType: 'json',
            type: 'POST',
            timeout: 60 * 60 * 1000,
            error: function(xhr) {
                toastService.showError("Import failed: " + xhr.responseText);
            },
            contentType: false, // NEEDED, DON'T REMOVE THIS
            processData: false, // NEEDED, DON'T REMOVE THIS
        }));
    }
}

function makeToast(id, message) {
    return {
        id: id,
        title: "Import status",
        message: message,
        icon: "plus"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'import') {
        return;
    }

    if (message.type === 'taskError') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'taskProgressCount') {
        toastService.showPersistent(makeToast(message.taskId, "Import in progress: " + message.progressCount));
    } else if (message.type === 'taskSucceeded') {
        const toast = makeToast(message.taskId, "Import finished successfully.");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);

        if (message.result.importedNoteId) {
            await appContext.tabManager.getActiveContext().setNote(message.result.importedNoteId);
        }
    }
});

export default {
    uploadFiles
}
