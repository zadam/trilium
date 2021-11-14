const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");

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

            const subRoot = getSubRoot(note);

            res.render("share", {
                note,
                subRoot
            });
        }
        else {
            res.send("FFF");
        }
    });

    router.get('/share/api/images/:noteId/:filename', (req, res, next) => {
        const image = shaca.getNote(req.params.noteId);

        if (!image) {
            return res.sendStatus(404);
        }
        else if (image.type !== 'image') {
            return res.sendStatus(400);
        }

        res.set('Content-Type', image.mime);

        res.send(image.getContent());
    });
}

module.exports = {
    register
}
