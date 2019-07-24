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
    const {linkTypes, maxNotes, maxDepth} = req.body;

    let noteIds = new Set([noteId]);
    let links = [];

    let depth = 0;

    while (true) {
        links = await getLinks(noteIds, linkTypes);

        if (depth === maxDepth) {
            break;
        }

        const newNoteIds = new Set(links.map(l => l.noteId).concat(links.map(l => l.targetNoteId)));

        if (newNoteIds.size === noteIds.size) {
            // no new note discovered, no need to search any further
            break;
        }

        if (newNoteIds.size > maxNotes) {
            // to many notes to display
            break;
        }

        noteIds = newNoteIds;

        depth++;
    }

    // keep only links coming from and targetting some note in the noteIds set
    links = links.filter(l => noteIds.has(l.noteId) && noteIds.has(l.targetNoteId));

    return links;
}

module.exports = {
    getLinkMap
};