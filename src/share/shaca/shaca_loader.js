"use strict";

const sql = require('../sql');
const shaca = require('./shaca.js');
const log = require('../../services/log');
const Note = require('./entities/note');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');
const shareRoot = require('../share_root');

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

    for (const row of sql.getRawRows(`SELECT noteId, title, type, mime FROM notes WHERE isDeleted = 0 AND noteId IN (${noteIdStr})`)) {
        new Note(row);
    }

    for (const row of sql.getRawRows(`SELECT branchId, noteId, parentNoteId, prefix, notePosition, isExpanded, utcDateModified FROM branches WHERE isDeleted = 0 AND noteId IN (${noteIdStr})`)) {
        new Branch(row);
    }

    // TODO: add filter for allowed attributes
    for (const row of sql.getRawRows(`SELECT attributeId, noteId, type, name, value, isInheritable, position, utcDateModified FROM attributes WHERE isDeleted = 0 AND noteId IN (${noteIdStr})`, [])) {
        new Attribute(row);
    }

    shaca.loaded = true;

    log.info(`Shaca load took ${Date.now() - start}ms`);
}

function ensureLoad() {
    if (!shaca.loaded) {
        load();
    }
}


module.exports = {
    load,
    ensureLoad
};
