"use strict";

const sql = require('./sql');
const utils = require('./utils');
const log = require('./log');
const ApiToken = require('../entities/api_token');
const Branch = require('../entities/branch');
const Note = require('../entities/note');
const Attribute = require('../entities/attribute');
const NoteRevision = require('../entities/note_revision');
const RecentNote = require('../entities/recent_note');
const Option = require('../entities/option');

function getSectorHashes(tableName, primaryKeyName, whereBranch) {
    const hashes = sql.getRows(`SELECT ${primaryKeyName} AS id, hash FROM ${tableName}`
        + (whereBranch ? ` WHERE ${whereBranch} ` : ''));

    // sorting is faster in memory
    hashes.sort((a, b) => a.id < b.id ? -1 : 1);

    const map = {};

    for (const {id, hash} of hashes) {
        map[id[0]] = (map[id[0]] || "") + hash;
    }

    for (const key in map) {
        map[key] = utils.hash(map[key]);
    }

    return map;
}

function getEntityHashes() {
    const startTime = new Date();

    const hashes = {
        notes: getSectorHashes(Note.entityName, Note.primaryKeyName),
        note_contents: getSectorHashes("note_contents", "noteId"),
        branches: getSectorHashes(Branch.entityName, Branch.primaryKeyName),
        note_revisions: getSectorHashes(NoteRevision.entityName, NoteRevision.primaryKeyName),
        note_revision_contents: getSectorHashes("note_revision_contents", "noteRevisionId"),
        recent_notes: getSectorHashes(RecentNote.entityName, RecentNote.primaryKeyName),
        options: getSectorHashes(Option.entityName, Option.primaryKeyName, "isSynced = 1"),
        attributes: getSectorHashes(Attribute.entityName, Attribute.primaryKeyName),
        api_tokens: getSectorHashes(ApiToken.entityName, ApiToken.primaryKeyName),
    };

    const elapsedTimeMs = Date.now() - startTime.getTime();

    log.info(`Content hash computation took ${elapsedTimeMs}ms`);

    return hashes;
}

function checkContentHashes(otherHashes) {
    const entityHashes = getEntityHashes();
    const failedChecks = [];

    for (const entityName in entityHashes) {
        const thisSectorHashes = entityHashes[entityName];
        const otherSectorHashes = otherHashes[entityName];

        const sectors = new Set(Object.keys(thisSectorHashes).concat(Object.keys(otherSectorHashes)));

        for (const sector of sectors) {
            if (thisSectorHashes[sector] !== otherSectorHashes[sector]) {
                log.info(`Content hash check for ${entityName} sector ${sector} FAILED. Local is ${thisSectorHashes[sector]}, remote is ${otherSectorHashes[sector]}`);

                failedChecks.push({ entityName, sector });
            }
        }
    }

    if (failedChecks.length === 0) {
        log.info("Content hash checks PASSED");
    }

    return failedChecks;
}

module.exports = {
    getEntityHashes,
    checkContentHashes
};
