"use strict";

const sql = require('../sql.js');
const shaca = require('./shaca.js');
const log = require('../../services/log.js');
const SNote = require('./entities/snote.js');
const SBranch = require('./entities/sbranch.js');
const SAttribute = require('./entities/sattribute.js');
const SAttachment = require('./entities/sattachment.js');
const shareRoot = require('../share_root.js');
const eventService = require('../../services/events.js');

function load() {
    const start = Date.now();
    shaca.reset();

    // using a raw query and passing arrays to avoid allocating new objects

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
        SELECT noteId, title, type, mime, blobId, utcDateModified, isProtected
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

    const rawAttachmentRows = sql.getRawRows(`
        SELECT attachmentId, ownerId, role, mime, title, blobId, utcDateModified 
        FROM attachments 
        WHERE isDeleted = 0 
          AND ownerId IN (${noteIdStr})`);

    rawAttachmentRows.sort((a, b) => a.position < b.position ? -1 : 1);

    for (const row of rawAttachmentRows) {
        new SAttachment(row);
    }

    shaca.loaded = true;

    log.info(`Shaca loaded ${rawNoteRows.length} notes, ${rawBranchRows.length} branches, ${rawAttachmentRows.length} attributes took ${Date.now() - start}ms`);
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
