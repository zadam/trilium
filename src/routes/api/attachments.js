const becca = require("../../becca/becca");
const utils = require("../../services/utils");
const blobService = require("../../services/blob.js");

function getAttachmentBlob(req) {
    const preview = req.query.preview === 'true';

    return blobService.getBlobPojo('attachments', req.params.attachmentId, { preview });
}

function getAttachments(req) {
    const includeContent = req.query.includeContent === 'true';
    const note = becca.getNoteOrThrow(req.params.noteId);

    return note.getAttachments()
        .map(attachment => processAttachment(attachment, includeContent));
}

function getAttachment(req) {
    const includeContent = req.query.includeContent === 'true';
    const {attachmentId} = req.params;

    const attachment = becca.getAttachmentOrThrow(attachmentId);

    return processAttachment(attachment, includeContent);
}

function processAttachment(attachment, includeContent) {
    const pojo = attachment.getPojo();

    if (includeContent) {
        if (utils.isStringNote(null, attachment.mime)) {
            pojo.content = attachment.getContent()?.toString();
            pojo.contentLength = pojo.content.length;

            const MAX_ATTACHMENT_LENGTH = 1_000_000;

            if (pojo.content.length > MAX_ATTACHMENT_LENGTH) {
                pojo.content = pojo.content.substring(0, MAX_ATTACHMENT_LENGTH);
            }
        } else {
            const content = attachment.getContent();
            pojo.contentLength = content?.length;
        }
    }

    return pojo;
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
