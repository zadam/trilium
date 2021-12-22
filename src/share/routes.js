const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");
const contentRenderer = require("./content_renderer.js");

function getSubRoot(note) {
    if (note.noteId === shareRoot.SHARE_ROOT_NOTE_ID) {
        return null;
    }

    const parentNote = note.getParentNotes()[0];

    if (parentNote.noteId === shareRoot.SHARE_ROOT_NOTE_ID) {
        return note;
    }

    return getSubRoot(parentNote);
}

function register(router) {
    router.get('/share/:noteId', (req, res, next) => {
        const {noteId} = req.params;

        shacaLoader.ensureLoad();

        if (noteId in shaca.notes) {
            const note = shaca.notes[noteId];

            const content = contentRenderer.getContent(note);

            const subRoot = getSubRoot(note);

            res.render("share/page", {
                note,
                content,
                subRoot
            });
        }
        else {
            res.status(404).render("share/404");
        }
    });

    router.get('/share/api/images/:noteId/:filename', (req, res, next) => {
        const image = shaca.getNote(req.params.noteId);

        if (!image) {
            return res.status(404).send("Not found");
        }
        else if (image.type !== 'image') {
            return res.status(400).send("Requested note is not an image");
        }

        res.set('Content-Type', image.mime);

        res.send(image.getContent());
    });

    router.get('/share/api/notes/:noteId/download', (req, res, next) => {
        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.status(404).send(`Not found`);
        }

        const utils = require("../services/utils");

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });
}

module.exports = {
    register
}
