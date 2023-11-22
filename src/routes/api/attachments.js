const becca = require('../../becca/becca.js');
const blobService = require('../../services/blob.js');
const ValidationError = require('../../errors/validation_error.js');
const imageService = require("../../services/image.js");

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

function getAllAttachments(req) {
    const {attachmentId} = req.params;
    // one particular attachment is requested, but return all note's attachments

    const attachment = becca.getAttachmentOrThrow(attachmentId);
    return attachment.getNote()?.getAttachments({includeContentLength: true}) || [];
}

function saveAttachment(req) {
    const {noteId} = req.params;
    const {attachmentId, role, mime, title, content} = req.body;
    const {matchBy} = req.query;

    const note = becca.getNoteOrThrow(noteId);
    note.saveAttachment({attachmentId, role, mime, title, content}, matchBy);
}

function uploadAttachment(req) {
    const {noteId} = req.params;
    const {file} = req;

    const note = becca.getNoteOrThrow(noteId);
    let url;

    if (["image/png", "image/jpg", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        const attachment = imageService.saveImageToAttachment(noteId, file.buffer, file.originalname, true, true);
        url = `api/attachments/${attachment.attachmentId}/image/${encodeURIComponent(attachment.title)}`;
    } else {
        const attachment = note.saveAttachment({
            role: 'file',
            mime: file.mimetype,
            title: file.originalname,
            content: file.buffer
        });

        url = `#root/${noteId}?viewMode=attachments&attachmentId=${attachment.attachmentId}`;
    }

    return {
        uploaded: true,
        url
    };
}

function renameAttachment(req) {
    const {title} = req.body;
    const {attachmentId} = req.params;

    const attachment = becca.getAttachmentOrThrow(attachmentId);

    if (!title?.trim()) {
        throw new ValidationError("Title must not be empty");
    }

    attachment.title = title;
    attachment.save();
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
    getAllAttachments,
    saveAttachment,
    uploadAttachment,
    renameAttachment,
    deleteAttachment,
    convertAttachmentToNote
};
