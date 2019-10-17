import infoService from "./info.js";
import treeService from "./tree.js";
import server from "./server.js";
import ws from "./ws.js";
import utils from "./utils.js";

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
            headers: server.getHeaders(),
            data: formData,
            dataType: 'json',
            type: 'POST',
            timeout: 60 * 60 * 1000,
            contentType: false, // NEEDED, DON'T REMOVE THIS
            processData: false, // NEEDED, DON'T REMOVE THIS
        }));
    }
}

ws.subscribeToMessages(async message => {
    const toast = {
        id: "import",
        title: "Import status",
        icon: "plus"
    };

    if (message.type === 'task-error' && message.taskType === 'import') {
        infoService.closePersistent(toast.id);
        infoService.showError(message.message);
        return;
    }

    if (message.type === 'task-progress-count' && message.taskType === 'import') {
        toast.message = "Import in progress: " + message.progressCount;

        infoService.showPersistent(toast);
    }

    if (message.type === 'task-succeeded' && message.taskType === 'import') {
        toast.message = "Import finished successfully.";
        toast.closeAfter = 5000;

        infoService.showPersistent(toast);

        await treeService.reloadNote(message.parentNoteId);

        if (message.importedNoteId) {
            const node = await treeService.activateNote(message.importedNoteId);

            node.setExpanded(true);
        }
    }
});

export default {
    uploadFiles
}