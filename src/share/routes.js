const express = require('express');
const path = require('path');

const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");
const contentRenderer = require("./content_renderer");

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

function register(router) {
    function renderNote(note, res) {
        if (!note) {
            res.status(404).render("share/404");
            return;
        }

        addNoIndexHeader(note, res);

        if (note.hasLabel('shareRaw') || ['image', 'file'].includes(note.type)) {
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
            subRoot
        });
    }

    router.use('/share/canvas_share.js', express.static(path.join(__dirname, 'canvas_share.js')));

    router.get(['/share', '/share/'], (req, res, next) => {
        shacaLoader.ensureLoad();

        renderNote(shaca.shareRootNote, res);
    });

    router.get('/share/:shareId', (req, res, next) => {
        shacaLoader.ensureLoad();

        const {shareId} = req.params;

        const note = shaca.aliasToNote[shareId] || shaca.notes[shareId];

        renderNote(note, res);
    });

    router.get('/share/api/notes/:noteId', (req, res, next) => {
        shacaLoader.ensureLoad();

        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.setHeader("Content-Type", "text/plain")
                .status(404)
                .send(`Note '${noteId}' not found`);
        }

        addNoIndexHeader(note, res);

        res.json(note.getPojoWithAttributes());
    });

    router.get('/share/api/notes/:noteId/download', (req, res, next) => {
        shacaLoader.ensureLoad();

        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.setHeader("Content-Type", "text/plain")
                .status(404)
                .send(`Note '${noteId}' not found`);
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

        const image = shaca.getNote(req.params.noteId);

        if (!image) {
            return res.setHeader('Content-Type', 'text/plain')
                .status(404)
                .send(`Note '${req.params.noteId}' not found`);
        }
        else if (!["image", "canvas"].includes(image.type)) {
            return res.setHeader('Content-Type', 'text/plain')
                .status(400)
                .send("Requested note is not a shareable image");
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
            } catch(err) {
                res.setHeader('Content-Type', 'text/plain')
                    .status(500)
                    .send("there was an error parsing excalidraw to svg");
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

        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.setHeader('Content-Type', 'text/plain')
                .status(404)
                .send(`Note '${noteId}' not found`);
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
