"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const treeService = require('../../services/tree');

async function getNotesAndBranches(noteIds) {
    noteIds = Array.from(new Set(noteIds));
    const notes = await treeService.getNotes(noteIds);

    noteIds = notes.map(n => n.noteId);

    const branches = await sql.getManyRows(` 
        SELECT 
            branches.branchId,
            branches.noteId,
            branches.parentNoteId,
            branches.notePosition,
            branches.prefix,
            branches.isExpanded
        FROM branches
        WHERE branches.isDeleted = 0
          AND (branches.noteId IN (???) OR parentNoteId IN (???))`, noteIds);

    // sorting in memory is faster
    branches.sort((a, b) => a.notePosition - b.notePosition < 0 ? -1 : 1);

    return {
        branches,
        notes
    };
}

async function getTree() {
    const hoistedNoteId = await optionService.getOption('hoistedNoteId');

    // we fetch all branches of notes, even if that particular branch isn't visible
    // this allows us to e.g. detect and properly display clones
    let noteIds = await sql.getColumn(`
        WITH RECURSIVE
            tree(branchId, noteId, isExpanded) AS (
            SELECT branchId, noteId, isExpanded FROM branches WHERE noteId = ? 
            UNION ALL
            SELECT branches.branchId, branches.noteId, branches.isExpanded FROM branches
              JOIN tree ON branches.parentNoteId = tree.noteId
              WHERE tree.isExpanded = 1 AND branches.isDeleted = 0
          )
        SELECT noteId FROM tree`, [hoistedNoteId]);

    noteIds.push('root');

    return await getNotesAndBranches(noteIds);
}

async function load(req) {
    return await getNotesAndBranches(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
