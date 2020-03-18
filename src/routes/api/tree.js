"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const treeService = require('../../services/tree');

async function getNotesAndBranchesAndAttributes(noteIds) {
    noteIds = Array.from(new Set(noteIds));
    const notes = await treeService.getNotes(noteIds);

    noteIds = notes.map(note => note.noteId);

    // joining child note to filter out not completely synchronised notes which would then cause errors later
    // cannot do that with parent because of root note's 'none' parent
    const branches = await sql.getManyRows(` 
        SELECT 
            branches.branchId,
            branches.noteId,
            branches.parentNoteId,
            branches.notePosition,
            branches.prefix,
            branches.isExpanded
        FROM branches
        JOIN notes AS child ON child.noteId = branches.noteId
        WHERE branches.isDeleted = 0
          AND (branches.noteId IN (???) OR parentNoteId IN (???))`, noteIds);

    // sorting in memory is faster
    branches.sort((a, b) => a.notePosition - b.notePosition < 0 ? -1 : 1);

    const attributes = await sql.getManyRows(`
        SELECT
            attributeId,
            noteId,
            type,
            name,
            value,
            position,
            isInheritable
        FROM attributes
        WHERE isDeleted = 0 AND noteId IN (???)`, noteIds);

    // sorting in memory is faster
    attributes.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

    return {
        branches,
        notes,
        attributes
    };
}

async function getTree() {
    const hoistedNoteId = await optionService.getOption('hoistedNoteId');

    // we fetch all branches of notes, even if that particular branch isn't visible
    // this allows us to e.g. detect and properly display clones
    const noteIds = await sql.getColumn(`
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

    return await getNotesAndBranchesAndAttributes(noteIds);
}

async function load(req) {
    return await getNotesAndBranchesAndAttributes(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
