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

    while (noteIds.size < maxNotes) {
        relations = await getRelations(noteIds);

        if (depth === maxDepth) {
            break;
        }

        let newNoteIds = relations.map(rel => rel.noteId)
                                  .concat(relations.map(rel => rel.targetNoteId))
                                  .filter(noteId => !noteIds.has(noteId));

        if (newNoteIds.length === 0) {
            // no new note discovered, no need to search any further
            break;
        }

        for (const newNoteId of newNoteIds) {
            noteIds.add(newNoteId);

            if (noteIds.size >= maxNotes) {
                break;
            }
        }

        depth++;
    }

    // keep only links coming from and targetting some note in the noteIds set
    relations = relations.filter(rel => noteIds.has(rel.noteId) && noteIds.has(rel.targetNoteId));

    return relations;
}

module.exports = {
    getLinkMap
};