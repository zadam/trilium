"use strict";

import imageService = require('../../services/image');
import becca = require('../../becca/becca');
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
import fs = require('fs');
import { Request, Response } from 'express';
import BNote = require('../../becca/entities/bnote');
import BRevision = require('../../becca/entities/brevision');
import { AppRequest } from '../route-interface';

function returnImageFromNote(req: Request, res: Response) {
    const image = becca.getNote(req.params.noteId);

    return returnImageInt(image, res);
}

function returnImageFromRevision(req: Request, res: Response) {
    const image = becca.getRevision(req.params.revisionId);

    return returnImageInt(image, res);
}

function returnImageInt(image: BNote | BRevision | null, res: Response) {
    if (!image) {
        res.set('Content-Type', 'image/png');
        return res.send(fs.readFileSync(`${RESOURCE_DIR}/db/image-deleted.png`));
    } else if (!["image", "canvas", "mermaid"].includes(image.type)) {
        return res.sendStatus(400);
    }

    if (image.type === 'canvas') {
        renderSvgAttachment(image, res, 'canvas-export.svg');
    } else if (image.type === 'mermaid') {
        renderSvgAttachment(image, res, 'mermaid-export.svg');
    } else {
        res.set('Content-Type', image.mime);
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(image.getContent());
    }
}

function renderSvgAttachment(image: BNote | BRevision, res: Response, attachmentName: string) {
    let svgString = '<svg/>'
    const attachment = image.getAttachmentByTitle(attachmentName);

    const content = attachment.getContent();
    if (attachment && typeof content === "string") {
        svgString = content;
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
}


function returnAttachedImage(req: Request, res: Response) {
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

function updateImage(req: AppRequest) {
    const {noteId} = req.params;
    const {file} = req;

    const note = becca.getNoteOrThrow(noteId);

    if (!file) {
        return {
            uploaded: false,
            message: `Missing image data.`
        };
    }

    if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return {
            uploaded: false,
            message: `Unknown image type: ${file.mimetype}`
        };
    }

    if (typeof file.buffer === "string") {
        return {
            uploaded: false,
            message: "Invalid image content."
        };
    }
    
    imageService.updateImage(noteId, file.buffer, file.originalname);

    return { uploaded: true };
}

export = {
    returnImageFromNote,
    returnImageFromRevision,
    returnAttachedImage,
    updateImage
};
