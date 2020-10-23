"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const treeService = require('../../services/tree');

function getNotesAndBranchesAndAttributes(noteIds) {
    noteIds = Array.from(new Set(noteIds));
    const notes = treeService.getNotes(noteIds);

    noteIds = notes.map(note => note.noteId);

    // joining child note to filter out not completely synchronised notes which would then cause errors later
    // cannot do that with parent because of root note's 'none' parent
    const branches = sql.getManyRows(` 
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

    const attributes = sql.getManyRows(`
        SELECT
            attributeId,
            noteId,
            type,
            name,
            value,
            position,
            isInheritable
        FROM attributes
        WHERE isDeleted = 0 
          AND (noteId IN (???) OR (type = 'relation' AND value IN (???)))`, noteIds);

    // sorting in memory is faster
    attributes.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

    return {
        branches,
        notes,
        attributes
    };
}

function getTree(req) {
    const subTreeNoteId = req.query.subTreeNoteId || optionService.getOption('hoistedNoteId');

    // FIXME: this query does not return ascendants of template notes
    const noteIds = sql.getColumn(`
        WITH RECURSIVE
            treeWithDescendants(noteId, isExpanded) AS (
                SELECT noteId, isExpanded FROM branches WHERE parentNoteId = ? AND isDeleted = 0
                UNION
                SELECT branches.noteId, branches.isExpanded FROM branches
                  JOIN treeWithDescendants ON branches.parentNoteId = treeWithDescendants.noteId
                WHERE treeWithDescendants.isExpanded = 1 
                  AND branches.isDeleted = 0
            ),
            treeWithDescendantsAndAscendants AS (
                SELECT noteId FROM treeWithDescendants
                UNION
                SELECT branches.parentNoteId FROM branches
                  JOIN treeWithDescendantsAndAscendants ON branches.noteId = treeWithDescendantsAndAscendants.noteId
                WHERE branches.isDeleted = 0
                  AND branches.parentNoteId != ?
            ),
            treeWithDescendantsAscendantsAndTemplates AS (
                SELECT noteId FROM treeWithDescendantsAndAscendants
                UNION
                SELECT attributes.value FROM attributes
                   JOIN treeWithDescendantsAscendantsAndTemplates ON attributes.noteId = treeWithDescendantsAscendantsAndTemplates.noteId
                WHERE attributes.isDeleted = 0
                    AND attributes.type = 'relation'
                    AND attributes.name = 'template'
            )
        SELECT noteId FROM treeWithDescendantsAscendantsAndTemplates`, [subTreeNoteId, subTreeNoteId]);

    noteIds.push(subTreeNoteId);console.log("noteIds", noteIds);

    return getNotesAndBranchesAndAttributes(noteIds);
}

function load(req) {
    return getNotesAndBranchesAndAttributes(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
