"use strict";

const sql = require('../sql');
const shaca = require('./shaca');
const log = require('../../services/log');
const SNote = require('./entities/snote');
const SBranch = require('./entities/sbranch');
const SAttribute = require('./entities/sattribute');
const shareRoot = require('../share_root');
const eventService = require("../../services/events");

function load() {
    const start = Date.now();
    shaca.reset();

    // using raw query and passing arrays to avoid allocating new objects

    const noteIds = sql.getColumn(`
        WITH RECURSIVE
        tree(noteId) AS (
            SELECT ?
            UNION
            SELECT branches.noteId FROM branches
              JOIN tree ON branches.parentNoteId = tree.noteId
            WHERE branches.isDeleted = 0
        )
        SELECT noteId FROM tree`, [shareRoot.SHARE_ROOT_NOTE_ID]);

    if (noteIds.length === 0) {
        shaca.loaded = true;

        return;
    }

    const noteIdStr = noteIds.map(noteId => `'${noteId}'`).join(",");

    const rawNoteRows = sql.getRawRows(`
        SELECT noteId, title, type, mime, utcDateModified, isProtected
        FROM notes 
        WHERE isDeleted = 0 
          AND noteId IN (${noteIdStr})`);

    for (const row of rawNoteRows) {
        new SNote(row);
    }

    const rawBranchRows = sql.getRawRows(`
        SELECT branchId, noteId, parentNoteId, prefix, isExpanded, utcDateModified 
        FROM branches 
        WHERE isDeleted = 0 
          AND parentNoteId IN (${noteIdStr}) 
        ORDER BY notePosition`);

    for (const row of rawBranchRows) {
        new SBranch(row);
    }

    const rawAttributeRows = sql.getRawRows(`
        SELECT attributeId, noteId, type, name, value, isInheritable, position, utcDateModified 
        FROM attributes 
        WHERE isDeleted = 0 
          AND noteId IN (${noteIdStr})`);

    for (const row of rawAttributeRows) {
        new SAttribute(row);
    }

    shaca.loaded = true;

    log.info(`Shaca loaded ${rawNoteRows.length} notes, ${rawBranchRows.length} branches, ${rawAttributeRows.length} attributes took ${Date.now() - start}ms`);
}

function ensureLoad() {
    if (!shaca.loaded) {
        load();
    }
}

eventService.subscribe([ eventService.ENTITY_CREATED, eventService.ENTITY_CHANGED, eventService.ENTITY_DELETED, eventService.ENTITY_CHANGE_SYNCED, eventService.ENTITY_DELETE_SYNCED ], ({ entityName, entity }) => {
    shaca.reset();
});

module.exports = {
    load,
    ensureLoad
};
