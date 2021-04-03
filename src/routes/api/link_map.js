"use strict";

const sql = require('../../services/sql');

function getRelations(noteIds) {
    noteIds = Array.from(noteIds);

    return [
        // first read all relations
        // some "system" relations are not included since they are rarely useful to see (#1820)
        ...sql.getManyRows(`
            SELECT noteId, name, value AS targetNoteId
            FROM attributes
            WHERE (noteId IN (???) OR value IN (???))
              AND type = 'relation'
              AND name NOT IN ('imageLink', 'relationMapLink', 'template')
              AND isDeleted = 0
              AND noteId != ''
              AND value != ''`, noteIds),
        // ... then read only imageLink relations which are not connecting parent and child
        // this is done to not show image links in the trivial case where they are direct children of the note to which they are included. Same heuristic as in note tree
        ...sql.getManyRows(`
            SELECT rel.noteId, rel.name, rel.value AS targetNoteId
            FROM attributes AS rel
            LEFT JOIN branches ON branches.parentNoteId = rel.noteId AND branches.noteId = rel.value AND branches.isDeleted = 0 
            WHERE (rel.noteId IN (???) OR rel.value IN (???))
              AND rel.type = 'relation'
              AND name NOT IN ('imageLink', 'relationMapLink', 'template')
              AND rel.isDeleted = 0
              AND rel.noteId != ''
              AND rel.value != ''
              AND branches.branchId IS NULL`, noteIds)
    ];
}

function getLinkMap(req) {
    const {noteId} = req.params;
    const {maxNotes, maxDepth} = req.body;

    let noteIds = new Set([noteId]);
    let relations;

    let depth = 0;

    while (noteIds.size < maxNotes) {
        relations = getRelations(noteIds);

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
