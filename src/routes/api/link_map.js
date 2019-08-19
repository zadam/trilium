"use strict";

const sql = require('../../services/sql');

async function getRelations(noteIds, relationNames) {
    return (await sql.getManyRows(`
        SELECT noteId, name, value AS targetNoteId
        FROM attributes
        WHERE (noteId IN (???) OR value IN (???))
          AND type = 'relation'
          AND isDeleted = 0
    `, Array.from(noteIds))).filter(l => relationNames.includes(l.name));
}

async function getLinkMap(req) {
    const {noteId} = req.params;
    const {relationNames, maxNotes, maxDepth} = req.body;

    let noteIds = new Set([noteId]);
    let relations;

    let depth = 0;

    while (true) {
        relations = await getRelations(noteIds, relationNames);

        if (depth === maxDepth) {
            break;
        }

        const newNoteIds = new Set(relations.map(rel => rel.noteId)
                                            .concat(relations.map(rel => rel.targetNoteId)));

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
    relations = relations.filter(rel => noteIds.has(rel.noteId) && noteIds.has(rel.targetNoteId));

    return relations;
}

module.exports = {
    getLinkMap
};