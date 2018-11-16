"use strict";

const noteService = require('../../services/notes');
const parseString = require('xml2js').parseString;

async function importOpml(fileBuffer, parentNote) {
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

    if (xml.opml.$.version !== '1.0' && xml.opml.$.version !== '1.1') {
        return [400, 'Unsupported OPML version ' + xml.opml.$.version + ', 1.0 or 1.1 expected instead.'];
    }

    const outlines = xml.opml.body[0].outline || [];
    let returnNote = null;

    for (const outline of outlines) {
        const note = await importOutline(outline, parentNote.noteId);

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

async function importOutline(outline, parentNoteId) {
    const {note} = await noteService.createNote(parentNoteId, outline.$.title, toHtml(outline.$.text));

    for (const childOutline of (outline.outline || [])) {
        await importOutline(childOutline, note.noteId);
    }

    return note;
}

module.exports = {
    importOpml
};