const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");
const utils = require("../services/utils");
const {JSDOM} = require("jsdom");

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

const NO_CONTENT = '<p>This note has no content.</p>';

function getChildrenList(note) {
    if (note.hasChildren()) {
        const document = new JSDOM().window.document;

        const ulEl = document.createElement("ul");

        for (const childNote of note.getChildNotes()) {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.appendChild(document.createTextNode(childNote.title));
            link.setAttribute("href", childNote.noteId);

            li.appendChild(link);
            ulEl.appendChild(li);
        }

        return '<p>Child notes:</p>' + ulEl.outerHTML;
    }
    else {
        return '';
    }
}

function getContent(note) {
    let content = note.getContent();

    if (note.type === 'text') {
        const isEmpty = !content?.trim() || (function() {
            const document = new JSDOM(content).window.document;

            return document.body.textContent.trim().length === 0
                && document.querySelectorAll("img").length === 0;
        })();

        if (isEmpty) {
            content = NO_CONTENT + getChildrenList(note);
        }
    }
    else if (note.type === 'code') {
        if (!content?.trim()) {
            content = NO_CONTENT + getChildrenList(note);
        }
        else {
            const document = new JSDOM().window.document;

            const preEl = document.createElement('pre');
            preEl.innerText = content;

            content = preEl.outerHTML;
        }
    }
    else if (note.type === 'book') {
        content = getChildrenList(note);
    }
    else {
        content = '<p>This note type cannot be displayed.</p>' + getChildrenList(note);
    }

    return content;
}

function register(router) {
    router.get('/share/:noteId', (req, res, next) => {
        const {noteId} = req.params;

        shacaLoader.ensureLoad();

        if (noteId in shaca.notes) {
            const note = shaca.notes[noteId];

            const content = getContent(note);

            const subRoot = getSubRoot(note);

            res.render("share", {
                note,
                content,
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
