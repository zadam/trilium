import treeService from './tree.js';
import protectedSessionHolder from './protected_session_holder.js';
import utils from './utils.js';
import server from './server.js';

function exportBranch(noteId) {
    const url = utils.getHost() + "/api/notes/" + noteId + "/export?protectedSessionId="
        + encodeURIComponent(protectedSessionHolder.getProtectedSessionId());

    utils.download(url);
}

let importNoteId;

function importBranch(noteId) {
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
        type: 'POST',
        contentType: false, // NEEDED, DON'T OMIT THIS
        processData: false, // NEEDED, DON'T OMIT THIS
    });

    await treeService.reload();
});

export default {
    exportBranch,
    importBranch
};