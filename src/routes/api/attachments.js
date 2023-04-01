const becca = require("../../becca/becca");
const NotFoundError = require("../../errors/not_found_error");
const utils = require("../../services/utils");
const noteService = require("../../services/notes");

function getAttachments(req) {
    const includeContent = req.query.includeContent === 'true';
    const {noteId} = req.params;

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' doesn't exist.`);
    }

    return note.getAttachments()
        .map(attachment => processAttachment(attachment, includeContent));
}

function getAttachment(req) {
    const includeContent = req.query.includeContent === 'true';
    const {noteId, attachmentId} = req.params;

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' doesn't exist.`);
    }

    const attachment = note.getAttachmentById(attachmentId);

    if (!attachment) {
        throw new NotFoundError(`Attachment '${attachmentId} of note '${noteId}' doesn't exist.`);
    }

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

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' doesn't exist.`);
    }

    note.saveAttachment({attachmentId, role, mime, title, content});
}

function deleteAttachment(req) {
    const {noteId, attachmentId} = req.params;

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' doesn't exist.`);
    }

    const attachment = note.getAttachmentById(attachmentId);

    if (attachment) {
        attachment.markAsDeleted();
    }
}

function convertAttachmentToNote(req) {
    const {noteId, attachmentId} = req.params;

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' doesn't exist.`);
    }

    return note.convertAttachmentToChildNote(attachmentId);
}

module.exports = {
    getAttachments,
    getAttachment,
    saveAttachment,
    deleteAttachment,
    convertAttachmentToNote
};
