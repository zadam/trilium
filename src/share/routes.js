const express = require('express');
const path = require('path');
const safeCompare = require('safe-compare');

const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");
const contentRenderer = require("./content_renderer");
const assetPath = require("../services/asset_path");
const appPath = require("../services/app_path");

/**
 * @param {SNote} note
 * @return {{note: SNote, branch: SBranch}|{}}
 */
function getSharedSubTreeRoot(note) {
    if (note.noteId === shareRoot.SHARE_ROOT_NOTE_ID) {
        // share root itself is not shared
        return {};
    }

    // every path leads to share root, but which one to choose?
    // for the sake of simplicity, URLs are not note paths
    const parentBranch = note.getParentBranches()[0];

    if (parentBranch.parentNoteId === shareRoot.SHARE_ROOT_NOTE_ID) {
        return {
            note,
            branch: parentBranch
        };
    }

    return getSharedSubTreeRoot(parentBranch.getParentNote());
}

function addNoIndexHeader(note, res) {
    if (note.isLabelTruthy('shareDisallowRobotIndexing')) {
        res.setHeader('X-Robots-Tag', 'noindex');
    }
}

function requestCredentials(res) {
    res.setHeader('WWW-Authenticate', 'Basic realm="User Visible Realm", charset="UTF-8"')
        .sendStatus(401);
}

/** @returns {SAttachment|boolean} */
function checkAttachmentAccess(attachmentId, req, res) {
    const attachment = shaca.getAttachment(attachmentId);

    if (!attachment) {
        res.status(404)
            .json({ message: `Attachment '${attachmentId}' not found.` });

        return false;
    }

    const note = checkNoteAccess(attachment.ownerId, req, res);

    // truthy note means the user has access, and we can return the attachment
    return note ? attachment : false;
}

/** @returns {SNote|boolean} */
function checkNoteAccess(noteId, req, res) {
    const note = shaca.getNote(noteId);

    if (!note) {
        res.status(404)
            .json({ message: `Note '${noteId}' not found.` });

        return false;
    }

    if (noteId === '_share' && !shaca.shareIndexEnabled) {
        res.status(403)
            .json({ message: `Accessing share index is forbidden.` });

        return false;
    }

    const credentials = note.getCredentials();

    if (credentials.length === 0) {
        return note;
    }

    const header = req.header("Authorization");

    if (!header?.startsWith("Basic ")) {
        requestCredentials(res);
        return false;
    }

    const base64Str = header.substring("Basic ".length);
    const buffer = Buffer.from(base64Str, 'base64');
    const authString = buffer.toString('utf-8');

    for (const credentialLabel of credentials) {
        if (safeCompare(authString, credentialLabel.value)) {
            return note; // success;
        }
    }

    return false;
}

function renderImageAttachment(image, res, attachmentName) {
    let svgString = '<svg/>'
    const attachment = image.getAttachmentByTitle(attachmentName);

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
}

function register(router) {
    function renderNote(note, req, res) {
        if (!note) {
            res.status(404).render("share/404");
            return;
        }

        if (!checkNoteAccess(note.noteId, req, res)) {
            requestCredentials(res);

            return;
        }

        addNoIndexHeader(note, res);

        if (note.isLabelTruthy('shareRaw')) {
            res.setHeader('Content-Type', note.mime)
                .send(note.getContent());

            return;
        }

        const {header, content, isEmpty} = contentRenderer.getContent(note);

        const subRoot = getSharedSubTreeRoot(note);

        res.render("share/page", {
            note,
            header,
            content,
            isEmpty,
            subRoot,
            assetPath,
            appPath
        });
    }

    router.get('/share/', (req, res, next) => {
        if (req.path.substr(-1) !== '/') {
            res.redirect('../share/');
            return;
        }

        shacaLoader.ensureLoad();

        renderNote(shaca.shareRootNote, req, res);
    });

    router.get('/share/:shareId', (req, res, next) => {
        shacaLoader.ensureLoad();

        const {shareId} = req.params;

        const note = shaca.aliasToNote[shareId] || shaca.notes[shareId];

        renderNote(note, req, res);
    });

    router.get('/share/api/notes/:noteId', (req, res, next) => {
        shacaLoader.ensureLoad();
        let note;

        if (!(note = checkNoteAccess(req.params.noteId, req, res))) {
            return;
        }

        addNoIndexHeader(note, res);

        res.json(note.getPojo());
    });

    router.get('/share/api/notes/:noteId/download', (req, res, next) => {
        shacaLoader.ensureLoad();

        let note;

        if (!(note = checkNoteAccess(req.params.noteId, req, res))) {
            return;
        }

        addNoIndexHeader(note, res);

        const utils = require("../services/utils");

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });

    // :filename is not used by trilium, but instead used for "save as" to assign a human-readable filename
    router.get('/share/api/images/:noteId/:filename', (req, res, next) => {
        shacaLoader.ensureLoad();

        let image;

        if (!(image = checkNoteAccess(req.params.noteId, req, res))) {
            return;
        }

        if (image.type === 'image') {
            // normal image
            res.set('Content-Type', image.mime);
            addNoIndexHeader(image, res);
            res.send(image.getContent());
        } else if (image.type === "canvas") {
            renderImageAttachment(image, res, 'canvas-export.svg');
        } else if (image.type === 'mermaid') {
            renderImageAttachment(image, res, 'mermaid-export.svg');
        } else {
            return res.status(400)
                .json({ message: "Requested note is not a shareable image" });
        }
    });

    // :filename is not used by trilium, but instead used for "save as" to assign a human-readable filename
    router.get('/share/api/attachments/:attachmentId/image/:filename', (req, res, next) => {
        shacaLoader.ensureLoad();

        let attachment;

        if (!(attachment = checkAttachmentAccess(req.params.attachmentId, req, res))) {
            return;
        }

        if (attachment.role === "image") {
            res.set('Content-Type', attachment.mime);
            addNoIndexHeader(attachment.note, res);
            res.send(attachment.getContent());
        } else {
            return res.status(400)
                .json({ message: "Requested attachment is not a shareable image" });
        }
    });

    router.get('/share/api/attachments/:attachmentId/download', (req, res, next) => {
        shacaLoader.ensureLoad();

        let attachment;

        if (!(attachment = checkAttachmentAccess(req.params.attachmentId, req, res))) {
            return;
        }

        addNoIndexHeader(attachment.note, res);

        const utils = require("../services/utils");

        const filename = utils.formatDownloadTitle(attachment.title, null, attachment.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', attachment.mime);

        res.send(attachment.getContent());
    });

    // used for PDF viewing
    router.get('/share/api/notes/:noteId/view', (req, res, next) => {
        shacaLoader.ensureLoad();

        let note;

        if (!(note = checkNoteAccess(req.params.noteId, req, res))) {
            return;
        }

        addNoIndexHeader(note, res);

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });
}

module.exports = {
    register
}
