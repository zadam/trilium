"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const protectedSessionService = require('../../services/protected_session');
const noteCacheService = require('../../services/note_cache');
const log = require('../../services/log');

async function getNotes(noteIds) {
    // we return also deleted notes which have been specifically asked for
    const notes = await sql.getManyRows(`
        SELECT 
          noteId,
          title,
          isProtected, 
          type,
          mime,
          isDeleted
        FROM notes
        WHERE noteId IN (???)`, noteIds);

    const noteMap = new Map(notes.map(note => [note.noteId, note]));

    const templateClassLabels = await sql.getManyRows(`
        SELECT 
          templAttr.noteId, 
          attr.name, 
          attr.value 
        FROM attributes templAttr
        JOIN attributes attr ON attr.noteId = templAttr.value
        WHERE 
          templAttr.isDeleted = 0 
          AND templAttr.type = 'relation'
          AND templAttr.name = 'template'
          AND templAttr.noteId IN (???)
          AND attr.isDeleted = 0
          AND attr.type = 'label'
          AND attr.name IN ('cssClass', 'iconClass')`, noteIds);

    const noteClassLabels = await sql.getManyRows(`
        SELECT 
           noteId, name, value 
        FROM attributes 
        WHERE 
           isDeleted = 0 
           AND type = 'label' 
           AND name IN ('cssClass', 'iconClass') 
           AND noteId IN (???)`, noteIds);

    // first template ones, then on the note itself so that note class label have priority
    // over template ones for iconClass (which can be only one)
    const allClassLabels = templateClassLabels.concat(noteClassLabels);

    for (const label of allClassLabels) {
        const note = noteMap.get(label.noteId);

        if (note) {
            if (label.name === 'cssClass') {
                note.cssClass = note.cssClass ? `${note.cssClass} ${label.value}` : label.value;
            }
            else if (label.name === 'iconClass') {
                note.iconClass = label.value;
            }
            else {
                log.error(`Unrecognized label name ${label.name}`);
            }
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
    return await getNotesAndBranches(req.body.noteIds);
}

module.exports = {
    getTree,
    load
};
