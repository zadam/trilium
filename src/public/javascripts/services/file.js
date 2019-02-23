import noteDetailService from "./note_detail.js";
import treeService from "./tree.js";
import server from "./server.js";

function openUploadFileDialog() {
    $("#file-upload").trigger('click');
}

async function uploadFiles(parentNoteId, files) {
    let noteId;

    for (const file of files) {
        const formData = new FormData();
        formData.append('upload', file);

        const resp = await $.ajax({
            url: baseApiUrl + 'notes/' + parentNoteId + '/upload',
            headers: server.getHeaders(),
            data: formData,
            type: 'POST',
            contentType: false, // NEEDED, DON'T OMIT THIS
            processData: false, // NEEDED, DON'T OMIT THIS
        });

        noteId = resp.noteId;
    }

    await treeService.reload();

    await treeService.activateNote(noteId);
}

$("#file-upload").change(async function() {
    const files = Array.from(this.files); // clone since we'll reset it just below

    // this is done to reset the field otherwise triggering import same file again would not work
    // https://github.com/zadam/trilium/issues/388
    $("#file-upload").val('');

    const parentNoteId = noteDetailService.getCurrentNoteId();
    await uploadFiles(parentNoteId, files);
});

export default {
    openUploadFileDialog,
    uploadFiles
}