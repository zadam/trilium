import treeService from './tree.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';

function exportBranch(branchId, type, format) {
    const url = utils.getHost() + `/api/notes/${branchId}/export/${type}/${format}?protectedSessionId=` + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());

    console.log(url);

    utils.download(url);
}

let importNoteId;

function importIntoNote(noteId) {
    importNoteId = noteId;

    $("#import-upload").trigger('click');
}

$("#import-upload").change(async function() {
    const formData = new FormData();
    formData.append('upload', this.files[0]);

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
});

export default {
    exportBranch,
    importIntoNote
};