"use strict";

const sql = require('../../services/sql');

async function getRelations(noteIds) {
    return (await sql.getManyRows(`
        SELECT noteId, name, value AS targetNoteId
        FROM attributes
        WHERE (noteId IN (???) OR value IN (???))
          AND type = 'relation'
          AND isDeleted = 0
          AND noteId != ''
          AND value != ''
    `, Array.from(noteIds)));
}

async function getLinkMap(req) {
    const {noteId} = req.params;
    const {maxNotes, maxDepth} = req.body;

    let noteIds = new Set([noteId]);
    let relations;

    let depth = 0;

    while (true) {
        relations = await getRelations(noteIds);

        if (depth === maxDepth) {
            break;
        }

        const newNoteIds = new Set(relations.map(rel => rel.noteId)
                                            .concat(relations.map(rel => rel.targetNoteId)));

        if (newNoteIds.size === noteIds.size) {
            // no new note discovered, no need to search any further
            break;
        }
        console.log(newNoteIds.size, maxNotes);
        if (newNoteIds.size > maxNotes) {
            // too many notes to display
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