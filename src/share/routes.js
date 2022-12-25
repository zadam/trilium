const express = require('express');
const path = require('path');
const safeCompare = require('safe-compare');

const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");
const contentRenderer = require("./content_renderer");
const assetPath = require("../services/asset_path");
const appPath = require("../services/app_path");

function getSharedSubTreeRoot(note) {
    if (note.noteId === shareRoot.SHARE_ROOT_NOTE_ID) {
        // share root itself is not shared
        return null;
    }

    // every path leads to share root, but which one to choose?
    // for sake of simplicity URLs are not note paths
    const parentNote = note.getParentNotes()[0];

    if (parentNote.noteId === shareRoot.SHARE_ROOT_NOTE_ID) {
        return note;
    }

    return getSharedSubTreeRoot(parentNote);
}

function addNoIndexHeader(note, res) {
    if (note.hasLabel('shareDisallowRobotIndexing')) {
        res.setHeader('X-Robots-Tag', 'noindex');
    }
}

function requestCredentials(res) {
    res.setHeader('WWW-Authenticate', 'Basic realm="User Visible Realm", charset="UTF-8"')
        .sendStatus(401);
}

function checkNoteAccess(noteId, req, res) {
    const note = shaca.getNote(noteId);

    if (!note) {
        res.status(404)
            .json({ message: `Note '${noteId}' not found` });

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

        if (note.hasLabel('shareRaw')) {
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

    router.use('/share/canvas_share.js', express.static(path.join(__dirname, 'canvas_share.js')));

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

        res.json(note.getPojoWithAttributes());
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

    // :filename is not used by trilium, but instead used for "save as" to assign a human readable filename
    router.get('/share/api/images/:noteId/:filename', (req, res, next) => {
        shacaLoader.ensureLoad();

        let image;

        if (!(image = checkNoteAccess(req.params.noteId, req, res))) {
            return;
        }

        if (!["image", "canvas"].includes(image.type)) {
            return res.status(400)
                .json({ message: "Requested note is not a shareable image" });
        } else if (image.type === "canvas") {
            /**
             * special "image" type. the canvas is actually type application/json
             * to avoid bitrot and enable usage as referenced image the svg is included.
             */
            const content = image.getContent();
            try {
                const data = JSON.parse(content);

                const svg = data.svg || '<svg />';
                addNoIndexHeader(image, res);
                res.set('Content-Type', "image/svg+xml");
                res.set("Cache-Control", "no-cache, no-store, must-revalidate");
                res.send(svg);
            } catch (err) {
                res.status(500)
                    .json({ message: "There was an error parsing excalidraw to svg." });
            }
        } else {
            // normal image
            res.set('Content-Type', image.mime);
            addNoIndexHeader(image, res);
            res.send(image.getContent());
        }
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
