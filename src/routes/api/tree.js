"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');

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
    const questionMarks = branches.map(() => "?").join(",");

    const notes = await sql.getRows(`
      SELECT noteId, title, isProtected, type, mime
      FROM notes WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds);

    protectedSessionService.decryptNotes(notes);

    notes.forEach(note => note.isProtected = !!note.isProtected);

    const relationships = await sql.getRows(`SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0 
         AND parentNoteId IN (${questionMarks})`, noteIds);

    const parentToChild = {};

    for (const rel of relationships) {
        parentToChild[rel.parentNoteId] = parentToChild[rel.parentNoteId] || [];
        parentToChild[rel.parentNoteId].push(rel.noteId);
    }

    return {
        startNotePath: await optionService.getOption('startNotePath'),
        branches: branches,
        notes: notes,
        parentToChild
    };
}

module.exports = {
    getTree
};
