const becca = require("../../becca/becca");
const blobService = require("../../services/blob.js");

function getAttachmentBlob(req) {
    const preview = req.query.preview === 'true';

    return blobService.getBlobPojo('attachments', req.params.attachmentId, { preview });
}

function getAttachments(req) {
    const note = becca.getNoteOrThrow(req.params.noteId);

    return note.getAttachments({includeContentLength: true});
}

function getAttachment(req) {
    const {attachmentId} = req.params;

    return becca.getAttachmentOrThrow(attachmentId, {includeContentLength: true});
}

function saveAttachment(req) {
    const {noteId} = req.params;
    const {attachmentId, role, mime, title, content} = req.body;

    const note = becca.getNoteOrThrow(noteId);
    note.saveAttachment({attachmentId, role, mime, title, content});
}

function deleteAttachment(req) {
    const {attachmentId} = req.params;

    const attachment = becca.getAttachment(attachmentId);

    if (attachment) {
        attachment.markAsDeleted();
    }
}

function convertAttachmentToNote(req) {
    const {attachmentId} = req.params;

    const attachment = becca.getAttachmentOrThrow(attachmentId);
    return attachment.convertToNote();
}

module.exports = {
    getAttachmentBlob,
    getAttachments,
    getAttachment,
    saveAttachment,
    deleteAttachment,
    convertAttachmentToNote
};
