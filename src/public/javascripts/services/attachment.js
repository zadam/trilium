import noteDetailService from "./note_detail.js";
import treeService from "./tree.js";
import server from "./server.js";

function uploadAttachment() {
    $("#attachment-upload").trigger('click');
}

$("#attachment-upload").change(async function() {
    const formData = new FormData();
    formData.append('upload', this.files[0]);

    const resp = await $.ajax({
        url: baseApiUrl + 'attachments/upload/' + noteDetailService.getCurrentNoteId(),
        headers: server.getHeaders(),
        data: formData,
        type: 'POST',
        contentType: false, // NEEDED, DON'T OMIT THIS
        processData: false, // NEEDED, DON'T OMIT THIS
    });

    await treeService.reload();

    await treeService.activateNode(resp.noteId);
});

export default {
    uploadAttachment
}