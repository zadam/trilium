"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const treeService = require('../../services/tree');

function getNotesAndBranchesAndAttributes(noteIds) {
    const notes = treeService.getNotesIncludingAscendants(noteIds);

    noteIds = new Set(notes.map(note => note.noteId));

    sql.fillNoteIdList(noteIds);

    // joining child note to filter out not completely synchronised notes which would then cause errors later
    // cannot do that with parent because of root note's 'none' parent
    const branches = sql.getRows(` 
        SELECT 
            branches.branchId,
            branches.noteId,
            branches.parentNoteId,
            branches.notePosition,
            branches.prefix,
            branches.isExpanded
        FROM param_list
        JOIN branches ON param_list.paramId = branches.noteId OR param_list.paramId = branches.parentNoteId
        JOIN notes AS child ON child.noteId = branches.noteId
        WHERE branches.isDeleted = 0`);

    const attributes = sql.getRows(`
        SELECT
            attributes.attributeId,
            attributes.noteId,
            attributes.type,
            attributes.name,
            attributes.value,
            attributes.position,
            attributes.isInheritable
        FROM param_list
        JOIN attributes ON attributes.noteId = param_list.paramId 
                        OR (attributes.type = 'relation' AND attributes.value = param_list.paramId)
        WHERE attributes.isDeleted = 0`);

    // we don't really care about the direction of the relation
    const missingTemplateNoteIds = attributes
        .filter(attr => attr.type === 'relation'
                && attr.name === 'template'
                && !noteIds.has(attr.value))
        .map(attr => attr.value);

    if (missingTemplateNoteIds.length > 0) {
        const templateData = getNotesAndBranchesAndAttributes(missingTemplateNoteIds);

        // there are going to be duplicates with simple concatenation, however:
        // 1) shouldn't matter for the frontend which will update the entity twice
        // 2) there shouldn't be many duplicates. There isn't that many templates
        addArrays(notes, templateData.notes);
        addArrays(branches, templateData.branches);
        addArrays(attributes, templateData.attributes);
    }

    // sorting in memory is faster
    branches.sort((a, b) => a.notePosition - b.notePosition < 0 ? -1 : 1);
    attributes.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

    return {
        branches,
        notes,
        attributes
    };
}

// should be fast based on https://stackoverflow.com/a/64826145/944162
// in this case it is assumed that target is potentially much larger than elementsToAdd
function addArrays(target, elementsToAdd) {
    while (elementsToAdd.length) {
        target.push(elementsToAdd.shift());
    }

    return target;
}

function getTree(req) {
    const subTreeNoteId = req.query.subTreeNoteId || 'root';

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
            )
        SELECT noteId FROM treeWithDescendants`, [subTreeNoteId]);

    noteIds.push(subTreeNoteId);

    return getNotesAndBranchesAndAttributes(noteIds);
}

function load(req) {
    return getNotesAndBranchesAndAttributes(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
