import treeService from './tree.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';

const $fileUploadInput = $("#import-file-upload-input");

function exportBranch(branchId, type, format) {
    const url = utils.getHost() + `/api/notes/${branchId}/export/${type}/${format}?protectedSessionId=` + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());

    utils.download(url);
}

async function importIntoNote(importNoteId) {
    const formData = new FormData();
    formData.append('upload', $fileUploadInput[0].files[0]);

    // this is done to reset the field otherwise triggering import same file again would not work
    // https://github.com/zadam/trilium/issues/388
    $fileUploadInput.val('');

    await $.ajax({
        url: baseApiUrl + 'notes/' + importNoteId + '/import',
        headers: server.getHeaders(),
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false, // NEEDED, DON'T REMOVE THIS
        processData: false, // NEEDED, DON'T REMOVE THIS
    })
        .fail((xhr, status, error) => alert('Import error: ' + xhr.responseText))
        .done(async note => {
            await treeService.reload();

            if (note) {
                const node = await treeService.activateNote(note.noteId);

                node.setExpanded(true);
            }
        });
}

export default {
    exportBranch,
    importIntoNote
};