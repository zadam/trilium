"use strict";

const imageService = require('../../services/image');
const becca = require('../../becca/becca');
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
const fs = require('fs');

function returnImage(req, res) {
    const image = becca.getNote(req.params.noteId);

    if (!image) {
        res.set('Content-Type', 'image/png');
        return res.send(fs.readFileSync(`${RESOURCE_DIR}/db/image-deleted.png`));
    }
    else if (!["image", "canvas"].includes(image.type)){
        return res.sendStatus(400);
    }

    /**
     * special "image" type. the canvas is actually type application/json
     * to avoid bitrot and enable usage as referenced image the svg is included.
     */
    if (image.type === 'canvas') {
        let svgString = '<svg/>'
        const attachment = image.getAttachmentByTitle('canvas-export.svg');

        if (attachment) {
            svgString = attachment.getContent();
        } else {
            // backwards compatibility, before attachments, the SVG was stored in the main note content as a separate key
            const contentSvg = image.getJsonContentSafely()?.svg;

            if (contentSvg) {
                svgString = contentSvg;
            }
        }

        const svg = svgString
        res.set('Content-Type', "image/svg+xml");
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(svg);
    } else {
        res.set('Content-Type', image.mime);
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(image.getContent());
    }
}

function returnAttachedImage(req, res) {
    const attachment = becca.getAttachment(req.params.attachmentId);

    if (!attachment) {
        res.set('Content-Type', 'image/png');
        return res.send(fs.readFileSync(`${RESOURCE_DIR}/db/image-deleted.png`));
    }

    if (!["image"].includes(attachment.role)) {
        return res.setHeader("Content-Type", "text/plain")
            .status(400)
            .send(`Attachment '${attachment.attachmentId}' has role '${attachment.role}', but 'image' was expected.`);
    }

    res.set('Content-Type', attachment.mime);
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(attachment.getContent());
}

function updateImage(req) {
    const {noteId} = req.params;
    const {file} = req;

    const note = becca.getNoteOrThrow(noteId);

    if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return {
            uploaded: false,
            message: `Unknown image type: ${file.mimetype}`
        };
    }

    imageService.updateImage(noteId, file.buffer, file.originalname);

    return { uploaded: true };
}

module.exports = {
    returnImage,
    returnAttachedImage,
    updateImage
};
