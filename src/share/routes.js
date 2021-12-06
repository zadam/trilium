const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");
const shareRoot = require("./share_root");
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
        const document = new JSDOM(content || "").window.document;

        const isEmpty = document.body.textContent.trim().length === 0
                && document.querySelectorAll("img").length === 0;

        if (isEmpty) {
            content = NO_CONTENT + getChildrenList(note);
        }
        else {
            for (const linkEl of document.querySelectorAll("a")) {
                const href = linkEl.getAttribute("href");

                if (href?.startsWith("#")) {
                    const notePathSegments = href.split("/");

                    linkEl.setAttribute("href", notePathSegments[notePathSegments.length - 1]);
                }
            }

            content = document.body.innerHTML;
        }
    }
    else if (note.type === 'code') {
        if (!content?.trim()) {
            content = NO_CONTENT + getChildrenList(note);
        }
        else {
            const document = new JSDOM().window.document;

            const preEl = document.createElement('pre');
            preEl.appendChild(document.createTextNode(content));

            content = preEl.outerHTML;
        }
    }
    else if (note.type === 'image') {
        content = `<img src="api/images/${note.noteId}/${note.title}?${note.utcDateModified}">`;
    }
    else if (note.type === 'file') {
        content = `<button type="button" onclick="location.href='api/notes/${note.noteId}/download'">Download file</button>`;
    }
    else if (note.type === 'book') {
        content = getChildrenList(note);
    }
    else {
        content = '<p>This note type cannot be displayed.</p>' + getChildrenList(note);
    }

    return `<div class="type-${note.type}">${content}</content>`;
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

    router.get('/share/api/notes/:noteId/:download', (req, res, next) => {
        const {noteId} = req.params;
        const note = shaca.getNote(noteId);

        if (!note) {
            return res.status(404).send(`Note ${noteId} doesn't exist.`);
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
