"use strict";

const noteService = require('../../services/notes');
const parseString = require('xml2js').parseString;
const protectedSessionService = require('../protected_session');
const htmlSanitizer = require('../html_sanitizer');

/**
 * @param {TaskContext} taskContext
 * @param {Buffer} fileBuffer
 * @param {Note} parentNote
 * @return {Promise<*[]|*>}
 */
async function importOpml(taskContext, fileBuffer, parentNote) {
    const xml = await new Promise(function(resolve, reject)
    {
        parseString(fileBuffer, function (err, result) {
            if (err) {
                reject(err);
            }
            else {
                resolve(result);
            }
        });
    });

    if (!['1.0', '1.1', '2.0'].includes(xml.opml.$.version)) {
        return [400, 'Unsupported OPML version ' + xml.opml.$.version + ', 1.0, 1.1 or 2.0 expected instead.'];
    }

    const opmlVersion = parseInt(xml.opml.$.version);

    function importOutline(outline, parentNoteId) {
        let title, content;

        if (opmlVersion === 1) {
            title = outline.$.title;
            content = toHtml(outline.$.text);

            if (!title || !title.trim()) {
                // https://github.com/zadam/trilium/issues/1862
                title = outline.$.text;
                content = '';
            }
        }
        else if (opmlVersion === 2) {
            title = outline.$.text;
            content = outline.$._note; // _note is already HTML
        }
        else {
            throw new Error("Unrecognized OPML version " + opmlVersion);
        }

        content = htmlSanitizer.sanitize(content || "");

        const {note} = noteService.createNewNote({
            parentNoteId,
            title,
            content,
            type: 'text',
            isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
        });

        taskContext.increaseProgressCount();

        for (const childOutline of (outline.outline || [])) {
            importOutline(childOutline, note.noteId);
        }

        return note;
    }

    const outlines = xml.opml.body[0].outline || [];
    let returnNote = null;

    for (const outline of outlines) {
        const note = importOutline(outline, parentNote.noteId);

        // first created note will be activated after import
        returnNote = returnNote || note;
    }

    return returnNote;
}

function toHtml(text) {
    if (!text) {
        return '';
    }

    return '<p>' + text.replace(/(?:\r\n|\r|\n)/g, '</p><p>') + '</p>';
}

module.exports = {
    importOpml
};
