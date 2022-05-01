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
            res.setHeader('Content-Type', note.mime);

            res.send(note.getContent());
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
            return res.status(404).send(`Note '${noteId}' not found`);
        }

        addNoIndexHeader(note, res);

        res.json(note.getPojoWithAttributes());
    });

    router.get('/share/api/notes/:noteId/download', (req, res, next) => {
        shacaLoader.ensureLoad();

        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.status(404).send(`Note '${noteId}' not found`);
        }

        addNoIndexHeader(note, res);

        const utils = require("../services/utils");

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });

    router.get('/share/api/images/:noteId/:filename', (req, res, next) => {
        shacaLoader.ensureLoad();

        const image = shaca.getNote(req.params.noteId);

        if (!image) {
            return res.status(404).send(`Note '${req.params.noteId}' not found`);
        }
        else if (image.type !== 'image') {
            return res.status(400).send("Requested note is not an image");
        }

        addNoIndexHeader(image, res);

        res.setHeader('Content-Type', image.mime);

        res.send(image.getContent());
    });

    // used for PDF viewing
    router.get('/share/api/notes/:noteId/view', (req, res, next) => {
        shacaLoader.ensureLoad();

        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.status(404).send(`Note '${noteId}' not found`);
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
