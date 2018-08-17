"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const protectedSessionService = require('../../services/protected_session');

async function getNotes(noteIds) {
    const notes = await sql.getManyRows(`
      SELECT noteId, title, isProtected, type, mime
      FROM notes WHERE isDeleted = 0 AND noteId IN (???)`, noteIds);

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

    notes.forEach(note => note.isProtected = !!note.isProtected);
    return notes;
}

async function getRelations(noteIds) {
    // we need to fetch both parentNoteId and noteId matches because we can have loaded child
    // of which only some of the parents has been loaded.

    return await sql.getManyRows(`SELECT branchId, noteId AS 'childNoteId', parentNoteId FROM branches WHERE isDeleted = 0 
         AND (parentNoteId IN (???) OR noteId IN (???))`, noteIds);
}

async function getTree() {
    // we fetch all branches of notes, even if that particular branch isn't visible
    // this allows us to e.g. detect and properly display clones
    const branches = await sql.getRows(`
        WITH RECURSIVE
            tree(branchId, noteId, isExpanded) AS (
            SELECT branchId, noteId, isExpanded FROM branches WHERE branchId = 'root' 
            UNION ALL
            SELECT branches.branchId, branches.noteId, branches.isExpanded FROM branches
              JOIN tree ON branches.parentNoteId = tree.noteId
              WHERE tree.isExpanded = 1 AND branches.isDeleted = 0
          )
        SELECT branches.* FROM tree JOIN branches USING(noteId) WHERE branches.isDeleted = 0 ORDER BY branches.notePosition`);

    const noteIds = Array.from(new Set(branches.map(b => b.noteId)));

    const notes = await getNotes(noteIds);

    const relations = await getRelations(noteIds);

    return {
        startNotePath: (await optionService.getOption('startNotePath')) || 'root',
        branches,
        notes,
        relations
    };
}

async function load(req) {
    let noteIds = req.body.noteIds;
    const branchIds = req.body.branchIds;

    if (branchIds && branchIds.length > 0) {
        noteIds = (await sql.getManyRows(`SELECT noteId FROM branches WHERE isDeleted = 0 AND branchId IN(???)`, branchIds))
            .map(note => note.noteId);
    }

    const branches = await sql.getManyRows(`SELECT * FROM branches WHERE isDeleted = 0 AND noteId IN (???)`, noteIds);

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
