"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const protectedSessionService = require('../../services/protected_session');

async function getNotes(noteIds) {
    const questionMarks = noteIds.map(() => "?").join(",");

    const notes = await sql.getRows(`
      SELECT noteId, title, isProtected, type, mime
      FROM notes WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds);

    protectedSessionService.decryptNotes(notes);

    notes.forEach(note => note.isProtected = !!note.isProtected);
    return notes;
}

async function getRelations(noteIds) {
    const questionMarks = noteIds.map(() => "?").join(",");

    return await sql.getRows(`SELECT branchId, noteId AS 'childNoteId', parentNoteId FROM branches WHERE isDeleted = 0 
         AND parentNoteId IN (${questionMarks})`, noteIds);
}

async function getTree() {
    const branches = await sql.getRows(`
        WITH RECURSIVE
            tree(branchId, noteId, isExpanded) AS (
            SELECT branchId, noteId, isExpanded FROM branches WHERE branchId = 'root' 
            UNION ALL
            SELECT branches.branchId, branches.noteId, branches.isExpanded FROM branches
              JOIN tree ON branches.parentNoteId = tree.noteId
              WHERE tree.isExpanded = 1 AND branches.isDeleted = 0
          )
        SELECT branches.* FROM tree JOIN branches USING(branchId);`);

    const noteIds = branches.map(b => b.noteId);

    const notes = await getNotes(noteIds);

    const relations = await getRelations(noteIds);

    return {
        startNotePath: await optionService.getOption('startNotePath'),
        branches,
        notes,
        relations
    };
}

async function load(req) {
    let noteIds = req.body.noteIds;
    const branchIds = req.body.branchIds;

    if (branchIds && branchIds.length > 0) {
        noteIds = await sql.getColumn(`SELECT noteId FROM branches WHERE isDeleted = 0 AND branchId IN(${branchIds.map(() => "?").join(",")})`, branchIds);
    }

    const questionMarks = noteIds.map(() => "?").join(",");

    const branches = await sql.getRows(`SELECT * FROM branches WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds);

    const notes = await getNotes(noteIds);

    const relations = await getRelations(noteIds);

    return {
        branches,
        notes,
        relations
    };
}

module.exports = {
    getTree,
    load
};
