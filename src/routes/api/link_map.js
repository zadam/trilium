"use strict";

const sql = require('../../services/sql');

async function getLinks(noteIds, linkTypes) {
    return (await sql.getManyRows(`
        SELECT noteId, targetNoteId, type
        FROM links
        WHERE (noteId IN (???) OR targetNoteId IN (???))
          AND isDeleted = 0
        UNION
        SELECT noteId, value, 'relation'
        FROM attributes
        WHERE (noteId IN (???) OR value IN (???))
          AND type = 'relation'
          AND isDeleted = 0
    `, Array.from(noteIds))).filter(l => linkTypes.includes(l.type));
}

async function getLinkMap(req) {
    const {noteId} = req.params;
    const {linkTypes, maxNotes} = req.body;

    let noteIds = new Set([noteId]);
    let links = [];

    while (true) {
        const newLinks = await getLinks(noteIds, linkTypes);
        const newNoteIds = new Set(newLinks.map(l => l.noteId).concat(newLinks.map(l => l.targetNoteId)));

        if (newNoteIds.size === noteIds.size) {
            // no new note discovered, no need to search any further
            break;
        }

        if (newNoteIds.size > maxNotes) {
            // to many notes to display
            break;
        }

        noteIds = newNoteIds;
        links = newLinks;
    }

    // keep only links coming from and targetting some note in the noteIds set
    links = links.filter(l => noteIds.has(l.noteId) && noteIds.has(l.targetNoteId));

    return links;
}

module.exports = {
    getLinkMap
};