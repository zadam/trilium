"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const protectedSessionService = require('../../services/protected_session');
const noteCacheService = require('../../services/note_cache');

async function getNotes(noteIds) {
    const notes = await sql.getManyRows(`
      SELECT 
             noteId, 
             title, 
             isProtected, 
             type, 
             mime
      FROM 
           notes 
      WHERE isDeleted = 0 
        AND noteId IN (???)`, noteIds);

    const cssClassLabels = await sql.getManyRows(`
      SELECT noteId, value FROM attributes WHERE isDeleted = 0 AND type = 'label' 
                                             AND name = 'cssClass' AND noteId IN (???)`, noteIds);

    for (const label of cssClassLabels) {
        // FIXME: inefficient!
        const note = notes.find(note => note.noteId === label.noteId);

        if (!note) {
            continue;
        }

        if (note.cssClass) {
            note.cssClass += " " + label.value;
        }
        else {
            note.cssClass = label.value;
        }
    }

    protectedSessionService.decryptNotes(notes);

    await noteCacheService.loadedPromise;

    notes.forEach(note => {
        note.isProtected = !!note.isProtected;
        note.archived = noteCacheService.isArchived(note.noteId)
    });

    return notes;
}

async function getNotesAndBranches(noteIds) {
    noteIds = Array.from(new Set(noteIds));
    const notes = await getNotes(noteIds);

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
    let noteIds = req.body.noteIds;
    const branchIds = req.body.branchIds;

    if (branchIds && branchIds.length > 0) {
        noteIds = (await sql.getManyRows(`SELECT noteId FROM branches WHERE isDeleted = 0 AND branchId IN(???)`, branchIds))
            .map(note => note.noteId);
    }

    return await getNotesAndBranches(noteIds);
}

module.exports = {
    getTree,
    load
};
